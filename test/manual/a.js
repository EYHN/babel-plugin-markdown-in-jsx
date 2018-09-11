const React = require('react');
const Markdown = require('babel-plugin-transform-markdown-in-jsx/component');

class FixtureA extends React.Component {
  render() {
    const number = 4;

    return (
      <div>
        <Markdown>
          # Title

          This is **bold**.

          Here is a number:{' '}
          <span style={{ fontWeight: 'bold' }}>
            {number}
          </span>. Here it is again: {number}.
        </Markdown>
        <div style={{ margin: '24px' }}>
          This part is **not** parsed as Markdown.
          <Markdown>
            But *this* part *is*.
          </Markdown>
        </div>
        <Markdown>
          Here is a [link](#thing).

          ```js
          var thing = 'two' === 48;
          var three = 4;
          ```
        </Markdown>

        <p>
          Here is{' '}
          <Markdown inline style={{ background: '#eee' }}>
            _interpolated_ markdown
          </Markdown>
        </p>
      </div>
    );
  }
}

module.exports = FixtureA;
