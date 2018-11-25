const _ = require('lodash');
const markdownIt = require('markdown-it');
const babylon = require('@babel/parser');
const HTMLtoJSX = require('./htmltojsx');
const stripIndent = require('strip-indent');
const join = require('path').posix.join;
const elementProps = new Set(['inline']);

const defaultOptions = {
  package: 'babel-plugin-markdown-in-jsx',
  proxy: false
}

module.exports = babel => {
  const babelTypes = babel.types;

  const markdownToJsx = (markdown, options, md) => {
    const text = stripIndent(markdown).trim();
    let html = options.inline ? md.renderInline(text) : md.render(text);
    const converter = new HTMLtoJSX({ createClass: false, tagName: options.tagName });

    if (options.inline) {
      html = `<span>${html}</span>`
    } else {
      html = `<div>${html}</div>`
    }

    let jsx = converter.convert(html);
    return jsx;
  };

  function processJSXElement(path, options, md) {
    const inline = path
      .get('openingElement')
      .node.attributes.some(attribute => {
        return (
          attribute.name.name === 'inline' &&
          (attribute.value === null || !!attribute.value)
        );
      });

    const fullCode = path.findParent(babelTypes.isProgram).hub.file.code;
    const mdStartIndex = path.get('openingElement').node.end;
    const mdEndIndex = path.get('closingElement').node.start;
    const contentText = fullCode.slice(mdStartIndex, mdEndIndex);

    const replacements = [];
    path.node.children.forEach((child, i) => {
      // JSXText is markdown; all else must be removed and reinserted.
      if (babelTypes.isJSXText(child)) return;
      const childText = fullCode.slice(child.start, child.end);
      // This should be unique since two nodes can't start at the same place.
      const nodeId = child.start;
      const placeholder = `bpjm${nodeId}`;
      replacements.push({
        id: nodeId,
        text: childText,
        node: child,
        placeholder
      });
    });

    // Replace from bottom to top to keep indexes in tact.
    let mdWithoutJsx = contentText;
    _.sortBy(replacements, ['contextIndex']).reverse().forEach(replacement => {
      const before = mdWithoutJsx.slice(
        0,
        replacement.node.start - mdStartIndex
      );
      const after = mdWithoutJsx.slice(replacement.node.end - mdStartIndex);
      mdWithoutJsx = [
        before,
        `$${replacement.placeholder}$`,
        after
      ].join('');
    });
    let jsx = markdownToJsx(mdWithoutJsx, { inline, tagName: options.proxy === true && (name => options.proxyContextName + '.' + name) }, md);
    // replacements.forEach(replacement => {
    //   // The HTML placeholder will have been replaced by a JSX comment.
    //   const jsxPlaceholder = `{/* ${replacement.placeholder} */}`;
    //   jsx = jsx.replace(jsxPlaceholder, replacement.text);
    // });

    const parsedJsx = babylon.parseExpression(jsx, { plugins: ['jsx'] });

    // Pass attributes from the element to its replacement div or span.
    const originalAttributes = path.get('openingElement').node.attributes;
    const cleanedAttributes = originalAttributes.filter(
      node => !elementProps.has(node.name.name)
    );
    parsedJsx.openingElement.attributes = cleanedAttributes;
    path.replaceWith(parsedJsx);

    path.traverse({
      JSXExpressionContainer(path) {
        if (babelTypes.isJSXEmptyExpression(path.node.expression) &&
          !!path.node.expression.innerComments &&
          path.node.expression.innerComments.length === 1) {
          for (let index = 0; index < replacements.length; index++) {
            const jsxPlaceholder = replacements[index].placeholder;
            if (path.node.expression.innerComments[0].value === jsxPlaceholder) {
              path.replaceWith(replacements[index].node);
              return;
            }
          }
        }
      },
      JSXText(path) {
        const strs = path.node.value.split(/(\$bpjm\d+\$)/);
        if (strs.length > 1) 
        {
          path.replaceWithMultiple(
            strs.map((text) => {
              if (/^\$bpjm\d+\$$/.test(text)) {
                for (let index = 0; index < replacements.length; index++) {
                  const placeholder = replacements[index].placeholder;
                  if (text === '$' + placeholder + '$') {
                    return replacements[index].node;
                  }
                }
              }
              return babelTypes.jsxText(text)
            })
          );
        }
      },
      JSXAttribute(path) {
        if (babelTypes.isStringLiteral(path.node.value))
        {
          const strs = path.node.value.value.split(/(\$bpjm\d+\$)/);
          if (strs.length > 1) 
          {
            path.get('value').replaceWith(babelTypes.JSXExpressionContainer(
              strs.map((text) => {
                if (/^\$bpjm\d+\$$/.test(text)) {
                  for (let index = 0; index < replacements.length; index++) {
                    const placeholder = replacements[index].placeholder;
                    if (text === '$' + placeholder + '$') {
                      if (babelTypes.isJSXExpressionContainer(replacements[index].node)) {
                        return replacements[index].node.expression;
                      }
                      return replacements[index].node;
                    }
                  }
                }
                return babelTypes.stringLiteral(text)
              }).reduce((pre, value) => {
                return babelTypes.binaryExpression('+', pre, value);
              })
            ));
          }
        }
      }
    });
  }

  const visitor = {};

  visitor.CallExpression = (path, state) => {
    const options = Object.assign({}, defaultOptions, state.opts);

    const arg = path.node.arguments[0];
    if (!babelTypes.isStringLiteral(arg) || arg.value.toLowerCase() !== join(options.package, 'component').toLowerCase()) return;

    let parent = path.parentPath;
    while (parent.isMemberExpression()) {
      parent = parent.parentPath;
    }
    if (!parent.isVariableDeclarator()) {
      throw path.buildCodeFrameError(
        `You must assign '${join(options.package, 'component')}' to a new variable.`
      );
    }
    state.tagName = parent.node.id.name;
    state.commonjs = true;
    path.parentPath.remove();
  };

  visitor.ImportDeclaration = (path, state) => {
    const options = Object.assign({}, defaultOptions, state.opts);

    if (path.node.source.value.toLowerCase() !== join(options.package, 'component').toLowerCase()) return;

    if (path.node.specifiers.length != 1 ||
      !(babelTypes.isImportDefaultSpecifier(path.node.specifiers[0]) || babelTypes.isImportNamespaceSpecifier(path.node.specifiers[0])) ||
      !babelTypes.isIdentifier(path.node.specifiers[0].local)
    ) {
      throw path.buildCodeFrameError(stripIndent(`
        You must import '${join(options.package, 'component')}' like:
          import Markdown from "${join(options.package, 'component')}";
          import * as Markdown from "${join(options.package, 'component')}";
        `));
    }

    state.tagName = path.node.specifiers[0].local.name;
    state.commonjs = false;
    path.remove();
  };

  visitor.JSXIdentifier = (jsxIdentifierPath, state) => {
    const options = Object.assign({}, defaultOptions, state.opts);
    // Find JSX opening and closing elements that match the name assigned at import.
    let parent = jsxIdentifierPath.parentPath;
    if (!state.tagName) return;
    if (jsxIdentifierPath.node.name !== state.tagName) return;
    if (parent.isJSXMemberExpression()) {
      if (parent.node.object !== jsxIdentifierPath.node) return;
      parent = parent.parentPath;
    }
    if (!parent.isJSXOpeningElement()) return;
    if (options.proxy && !state.proxyContextName) {
      let i = 0;
      let declaratorName = 'P';
      while (jsxIdentifierPath.scope.hasBinding(declaratorName)) {
        declaratorName = 'P_' + i++;
      }
      const ProgramPath = jsxIdentifierPath.findParent(babelTypes.isProgram);
      if (state.commonjs) {
        ProgramPath.unshiftContainer('body',
          babelTypes.variableDeclaration('var', [
            babelTypes.variableDeclarator(babelTypes.identifier(declaratorName),
              babelTypes.callExpression(babelTypes.identifier('require'), [
                babelTypes.stringLiteral(join(options.package, 'component/proxy'))
              ])
            )])
        );
        state.proxyContextName = declaratorName;
      } else {
        ProgramPath.unshiftContainer('body',
          babelTypes.importDeclaration(
            [babelTypes.importNamespaceSpecifier(babelTypes.identifier(declaratorName))],
            babelTypes.stringLiteral(join(options.package, 'component/proxy'))
          )
        );
        state.proxyContextName = declaratorName;
      }
    }
    const jsxElementPath = jsxIdentifierPath.findParent(
      babelTypes.isJSXElement
    );

    const md = markdownIt({
      html: true,
      ...options.markdownOptions
    });

    if (options.markdownPlugins) {
      if (options.markdownPlugins instanceof Array) {
        options.markdownPlugins.forEach(plugin => {
          if (plugin instanceof Array) {
            let [p, ...opts] = plugin;
            if (typeof p === 'string') {
              p = require(p);
            }
            md.use(p, ...opts);
          } else if (typeof plugin === 'string') {
            md.use(require(plugin));
          } else {
            md.use(plugin);
          }
        });
      } else {
        throw new Error('Option \'plugins\' should be a array.');
      }
    }

    processJSXElement(jsxElementPath, Object.assign({}, options, { proxyContextName: state.proxyContextName }), md);
  };

  return { visitor };
};
