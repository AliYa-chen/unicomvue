# Third-party notices

## Liquid Glass Web Component

The bottom navigation loads a vendored build of GooseHyperGlassCDN, which
contains work derived from AndroidLiquidGlass, liquid-glass-webgl and
siri-glsl. Its Apache-2.0 license and attribution notice are retained in
`src/vendor/liquid-glass/LICENSE` and `src/vendor/liquid-glass/NOTICE`.

The source bundle was downloaded from
`https://glass.goose.cc.cd/liquid-glass.js` (SHA-256
`6578d9337b0d7262ff2a3a1bd307119231151b25f7fc8f3fe6fc4da4aa778e44`).
Local changes remove development logs and the catalog back button from the
single-tab mode, enable transparent framebuffer and surface-alpha compositing,
and complete cleanup/reconnection handling. The modified file carries a notice
at its beginning.

## NetworkPanel

The built-in speed-test target list in `src/config/speedTest.js` is derived from
[NetworkPanel](https://github.com/ljxi/NetworkPanel). The continuous download
worker behavior was independently adapted for this project with explicit
request cancellation and without NetworkPanel's logging service.

MIT License

Copyright (c) 2024 Whoami

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
