const React = require('react');
const ProxyContext = React.createContext({});

const builtinComponentNames = {
  clippath: 'clipPath',
  fecolormatrix: 'feColorMatrix',
  fecomponenttransfer: 'feComponentTransfer',
  fecomposite: 'feComposite',
  feconvolvematrix: 'feConvolveMatrix',
  fediffuselighting: 'feDiffuseLighting',
  fedisplacementmap: 'feDisplacementMap',
  fedistantlight: 'feDistantLight',
  feflood: 'feFlood',
  fefunca: 'feFuncA',
  fefuncb: 'feFuncB',
  fefuncg: 'feFuncG',
  fefuncr: 'feFuncR',
  fegaussianblur: 'feGaussianBlur',
  feimage: 'feImage',
  femerge: 'feMerge',
  femergenode: 'feMergeNode',
  femorphology: 'feMorphology',
  feoffset: 'feOffset',
  fepointlight: 'fePointLight',
  fespecularlighting: 'feSpecularLighting',
  fespotlight: 'feSpotLight',
  fetile: 'feTile',
  feturbulence: 'feTurbulence',
  filter: 'filter',
  foreignobject: 'foreignObject',
  lineargradient: 'linearGradient',
  radialgradient: 'radialGradient',
  textpath: 'textPath'
}

module.exports = new Proxy({}, {
  get: (_, key) => {
    if (key === 'Provider') {
      return ProxyContext.Provider
    }
    key = key.toLowerCase();
    if (key in builtinComponentNames) {
      key = builtinComponentNames[key];
    }
    return (props) => (
      React.createElement(ProxyContext.Consumer, undefined, proxy => {
        if (key in proxy) {
          return React.createElement(proxy[key], props);
        } else {
          return React.createElement(key, props);
        }
      })
    )
  }
});