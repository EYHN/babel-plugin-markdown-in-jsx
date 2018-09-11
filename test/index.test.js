const babel = require('@babel/core');
const babelEnv = require('@babel/preset-env');
const babelReact = require('@babel/preset-react');
const plugin = require('../');

const transform = (code, option) => {
  const module = `
    const React = require('react');
    const Markdown = require('Markdown/component');
    function TestComponent() {
      ${code};
    }`;
  return babel.transform(module, {
    presets: [babelEnv, babelReact],
    plugins: [[plugin, {package: 'Markdown', ...option}]]
  }).code;
};

test('basic usage', () => {
  const renderBody = `return (
    <Markdown>
      # Title

      This is **bold.**

      Here is a [link](/some/url).
    </Markdown>
  )`;

  expect(transform(renderBody)).toMatchSnapshot();
});

test('call default', () => {
  const renderBody = `return (
    <Markdown.default>
      # Title

      This is **bold.**

      Here is a [link](/some/url).
    </Markdown.default>
  )`;

  expect(transform(renderBody)).toMatchSnapshot();
});

test('import declaration', () => {
  const renderBody = `import * as React from 'react';
import Markdown from 'Markdown/component';
function TestComponent() {
  return (
    <Markdown>
      # Title

      This is **bold.**

      Here is a [link](/some/url).
    </Markdown>
  )
}`;

  const code = babel.transform(renderBody, {
    presets: [babelEnv, babelReact],
    plugins: [[plugin, {package: 'Markdown'}]]
  }).code

  expect(code).toMatchSnapshot();
});

test('basic usage inline', () => {
  const renderBody = `return (
    <div>
      Here is <Markdown inline>_interpolated_ markdown</Markdown>
    </div>
  )`;

  expect(transform(renderBody)).toMatchSnapshot();
});

test('nested jsx', () => {
  const renderBody = `var number = 4;
    return (
      <Markdown>
        Here is a number: <span style={{ fontWeight: 'bold' }}>{number}</span>. Here it is again: {number}.
      </Markdown>
    )`;

  expect(transform(renderBody)).toMatchSnapshot();
});

test('extra props to element', () => {
  const renderBody = `return (
    <p>
      Here is <Markdown inline style={{ background: '#eee' }}>_interpolated_ markdown</Markdown>
    </p>
  )`;

  expect(transform(renderBody)).toMatchSnapshot();
});

test('nest Markdown components', () => {
  const renderBody = `return (
    <Markdown>
      **markdown**
      <div>
        **no markdown**
      </div>
      <Markdown>
        **markdown**
      </Markdown>
      {/*common comments*/}
    </Markdown>
  )`;

  expect(transform(renderBody)).toMatchSnapshot();
});

test('bulitin component proxy', () => {
  const ReactDOMServer = require('react-dom/server');
  const React = require('react');

  const proxy = require('../component/proxy');

  const html = ReactDOMServer.renderToString(<div>
      <proxy.div>123</proxy.div>
      <proxy.Provider value={{p: ({children}) => <p>123{children}</p>}}>
        <proxy.p>abc</proxy.p>
      </proxy.Provider>
      123
    </div>);

  expect(html).toMatchSnapshot();
});

test('transform to html with proxy', () => {
  const renderBody = `return (
    <Markdown>
      **markdown**
      <div>
        **no markdown**
      </div>
      <Markdown>
        123
        **markdown**
      </Markdown>
      {/*common comments*/}
    </Markdown>
  )`;

  expect(transform(renderBody, {proxy: true})).toMatchSnapshot();
});
