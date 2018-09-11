const React = require('react');
const ReactDOM = require('react-dom');
const FixtureA = require('./a');

const container = document.createElement('div');
document.body.appendChild(container);

ReactDOM.render(
  <div>
    <FixtureA />
  </div>,
  container
);
