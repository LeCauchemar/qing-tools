import io

css = io.open('site/assets/site.css', encoding='utf-8').read()
print('css braces', css.count('{'), css.count('}'), 'fffd', css.count('\ufffd'))
html = io.open('site/index.html', encoding='utf-8').read()
print('html len', len(html), 'fffd', html.count('\ufffd'), 'stage', html.count('id="stage"'))
js = io.open('site/assets/site.js', encoding='utf-8').read()
print('js len', len(js), 'fffd', js.count('\ufffd'))
