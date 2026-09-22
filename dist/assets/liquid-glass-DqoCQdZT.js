(()=>{var e=Object.defineProperty,t=(t,n,r)=>n in t?e(t,n,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[n]=r,n=(e,n,r)=>t(e,typeof n==`symbol`?n:n+``,r),r=`
// Corner style: 0 = circular (standard arc), 1 = continuous (squircle/superellipse).
// Declared here (in SDF_GLSL) because sdShape references it, and SDF_GLSL is
// included by multiple shaders (element, shadow, highlight, plain-rect).
uniform float uCornerStyle;

// --- Continuous-curvature SDF texture (capsule shape) ---
// When uUseContinuousSdf > 0.5, sdShape() dispatches to sdContinuousCurvature
// which samples a precomputed SDF texture (generated from the G2-continuous
// Bezier path in continuous-curve.ts). Only the dialog card sets this to 1;
// other shaders that include SDF_GLSL leave it at the default 0 — sdShape
// falls through to the analytic sdRoundedRect / sdContinuousRoundedRect path.
uniform sampler2D uContinuousSdf;
uniform float uUseContinuousSdf;        // 0 or 1
uniform vec2  uContinuousSdfTexSize;    // SDF texture size in px (256, 256)
uniform vec2  uContinuousSdfElementSize; // element's original w,h in px

// radiusAt — picks the corner radius from cornerRadii based on which
// quadrant 'coord' is in. For uniform radii (the catalog case) this
// always returns the same value.
float radiusAt(vec2 coord, vec4 radii) {
    if (coord.x >= 0.0) {
        if (coord.y <= 0.0) return radii.y;
        else return radii.z;
    } else {
        if (coord.y <= 0.0) return radii.x;
        else return radii.w;
    }
}

// sdRoundedRect — signed distance to a rounded-rect boundary.
// Negative inside, positive outside, zero on the edge.
// Uses standard circular arcs for the corners.
float sdRoundedRect(vec2 coord, vec2 halfSize, float radius) {
    vec2 cornerCoord = abs(coord) - (halfSize - vec2(radius));
    float outside = length(max(cornerCoord, 0.0)) - radius;
    float inside = min(max(cornerCoord.x, cornerCoord.y), 0.0);
    return outside + inside;
}

// sdContinuousRoundedRect — continuous-curvature rounded rect.
// The original uses G2-continuous Bezier corners (ContinuousCurvatureRoundedRectangleCornerBuilder).
// The visual difference between Continuous and Circular is very subtle (only
// curvature continuity at the tangent points). For the SDF-based renderer,
// the circular arc SDF (sdRoundedRect) is a close enough approximation — the
// Bezier corners deviate from the arc by <0.5% of the radius, which is
// sub-pixel at typical element sizes.
//
// When uCornerStyle=1 (continuous), we use sdRoundedRect directly. The
// difference from the original is imperceptible. A future upgrade could
// implement exact Bezier SDF for pixel-perfect matching.
float sdContinuousRoundedRect(vec2 coord, vec2 halfSize, float radius) {
    return sdRoundedRect(coord, halfSize, radius);
}

// sampleClipMask — sample R channel (coverage) from the mask texture.
// Returns browser-native AA coverage [0,1] for clip + edgeAlpha.
float sampleClipMask(vec2 coord, vec2 halfSize, float radius) {
    float maxDim = max(max(uContinuousSdfElementSize.x, uContinuousSdfElementSize.y), 1e-4);
    float aspectW = uContinuousSdfElementSize.x / maxDim;
    float margin = 4.0;
    float drawW = (uContinuousSdfTexSize.x - 2.0 * margin) * aspectW;
    float scale = drawW / max(uContinuousSdfElementSize.x, 1e-4);
    vec2 tex = uContinuousSdfTexSize * 0.5 + coord * scale;
    vec2 uv = tex / uContinuousSdfTexSize;
    return texture2D(uContinuousSdf, uv).r;  // R = coverage [0,1]
}

// sampleClipSdf — sample G channel (SDF) from the mask texture.
// Returns signed distance: negative inside, positive outside, 0 at edge.
// Same shape as sampleClipMask (both from the same Bezier path), so clip
// and stroke shapes are always identical.
float sampleClipSdf(vec2 coord, vec2 halfSize, float radius) {
    float maxDim = max(max(uContinuousSdfElementSize.x, uContinuousSdfElementSize.y), 1e-4);
    float aspectW = uContinuousSdfElementSize.x / maxDim;
    float margin = 4.0;
    float drawW = (uContinuousSdfTexSize.x - 2.0 * margin) * aspectW;
    float scale = drawW / max(uContinuousSdfElementSize.x, 1e-4);
    vec2 tex = uContinuousSdfTexSize * 0.5 + coord * scale;
    vec2 uv = tex / uContinuousSdfTexSize;
    float g = texture2D(uContinuousSdf, uv).g;  // G = SDF [0,1]
    return (g * 2.0 - 1.0) * radius;  // decode to element-space distance
}

// sdClipShape — SDF for clip/discard when uUseContinuousSdf is OFF.
float sdClipShape(vec2 coord, vec2 halfSize, float radius) {
    return sdRoundedRect(coord, halfSize, radius);
}

// sdShape — SDF for refraction/highlight internal calculations.
// When uUseContinuousSdf=1, uses sampleClipSdf (same shape as clip mask).
// Otherwise uses sdRoundedRect.
float sdShape(vec2 coord, vec2 halfSize, float radius) {
    if (uUseContinuousSdf > 0.5) {
        return sampleClipSdf(coord, halfSize, radius);
    }
    return sdRoundedRect(coord, halfSize, radius);
}

// gradSdRoundedRect — gradient of the SDF (points outward from edge).
// Used both for refraction direction and highlight specular.
vec2 gradSdRoundedRect(vec2 coord, vec2 halfSize, float radius) {
    vec2 cornerCoord = abs(coord) - (halfSize - vec2(radius));
    if (cornerCoord.x >= 0.0 || cornerCoord.y >= 0.0) {
        vec2 v = max(cornerCoord, vec2(0.0));
        // Guard against normalize(0,0) -> NaN
        float len = length(v);
        if (len < 1e-6) return vec2(0.0);
        return sign(coord) * (v / len);
    } else {
        float gradX = step(cornerCoord.y, cornerCoord.x);
        return sign(coord) * vec2(gradX, 1.0 - gradX);
    }
}

// rotateBy — rotate a 2D vector by angle (radians). Used to un-rotate the
// sample coord into the element's local space (so the SDF shape appears
// rotated by +uElementRotation), and to rotate refraction offsets back to
// screen space.
vec2 rotateBy(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}
`,i=`
// Returns wallpaper UV for a canvas pixel coordinate (top-left origin).
vec2 coverUv(vec2 canvasPx) {
    float canvasAspect = uCanvasSize.x / uCanvasSize.y;
    float wpAspect = uWallpaperSize.x / uWallpaperSize.y;
    vec2 uv = canvasPx / uCanvasSize;
    if (wpAspect > canvasAspect) {
        // Wallpaper is wider than canvas — crop horizontally.
        float s = canvasAspect / wpAspect;
        uv.x = (uv.x - 0.5) * s + 0.5;
    } else {
        // Wallpaper is taller than canvas — crop vertically.
        float s = wpAspect / canvasAspect;
        uv.y = (uv.y - 0.5) * s + 0.5;
    }
    return uv;
}

// Per-axis scale: 1 canvas pixel in wallpaper UV units.
// Used to convert a blur radius (in canvas px) into UV-space offsets
// for poisson-disc sampling.
vec2 canvasPxToUvScale() {
    float canvasAspect = uCanvasSize.x / uCanvasSize.y;
    float wpAspect = uWallpaperSize.x / uWallpaperSize.y;
    if (wpAspect > canvasAspect) {
        return vec2(canvasAspect / wpAspect, 1.0) / uCanvasSize;
    } else {
        return vec2(1.0, wpAspect / canvasAspect) / uCanvasSize;
    }
}
`,a=`
uniform sampler2D uBackdrop;
uniform sampler2D uWallpaperSampler;  // wallpaper texture (unscaled backdrop for toggle knobs)
uniform sampler2D uTabsBackdropSampler;  // tabsBackdrop FBO (tinted scene for indicator CombinedBackdrop)
uniform vec2  uCanvasSize;        // canvas size in px
uniform vec2  uWallpaperSize;     // UNUSED — kept for uniform-set compatibility
uniform vec2  uElementOffset;     // element top-left in canvas px (SCALED rect — where the quad is drawn)
uniform vec2  uElementSize;       // element size in px (SCALED — includes graphicsLayer scaleX/scaleY)
uniform vec4  uCornerRadii;       // (topLeft, topRight, bottomRight, bottomLeft) in px (ORIGINAL, unscaled)
uniform float uRefractionHeight;  // px (ORIGINAL space — NOT scaled by layerScale, faithful to AGSL)
uniform float uRefractionAmount;  // px (ORIGINAL space — NOT scaled, faithful to AGSL)
// --- Layer transform (faithful to graphicsLayer { scaleX, scaleY }) ---
// The original applies the refraction shader at the ORIGINAL element size, THEN
// scales the entire rendered layer by (scaleX, scaleY) via graphicsLayer. To
// replicate this in a single-pass shader, we compute the SDF/refraction in
// ORIGINAL space (by dividing the screen-space centered coord by uLayerScale),
// then map the refraction offset back to screen space for backdrop sampling.
// This keeps the SDF shape correct (not stretched) while covering the scaled rect.
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled by graphicsLayer)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer — maps original→screen
uniform float uElementRotation;    // rotation in radians (graphicsLayer rotationZ) — 0 = none
uniform float uDepthEffect;       // 0 or 1
uniform float uChromaticAberration; // 0 or 1
uniform float uBlurRadius;        // px
uniform float uSaturation;        // vibrancy = 1.5
uniform float uBrightness;        // brightness offset (0 for vibrancy)
uniform float uContrast;          // 1.0 for vibrancy
uniform vec4  uTintColor;         // rgba; alpha 0 = no tint
uniform vec4  uSurfaceColor;      // rgba; alpha 0 = no surface
uniform vec4  uHighlightColor;    // rgb + 1.0 (alpha handled by uHighlightAlpha)
uniform float uHighlightAngle;    // radians
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;     // 0=default, 1=ambient, 2=plain
uniform float uHighlightStrokeWidth; // px (full stroke width, matching paint.strokeWidth)
uniform float uHighlightBlur;     // px (BlurMaskFilter radius)
// (Inner shadow removed — moved to Step 2b post-pass with Canvas2D ring mask.)
// Content scale (non-uniform, faithful to LiquidToggle.kt / LiquidSlider.kt):
//   scale(scaleX, scaleY) { drawBackdrop() }
// Toggle: X gooseLerp(2/3, 0.75, p), Y gooseLerp(0, 0.75, p)
// Slider: X gooseLerp(2/3, 1, p),    Y gooseLerp(0, 1, p)
// At rest Y=0 → backdrop sampled from a single horizontal line (degenerate),
// but the white overlay (alpha=1) hides it. When pressed, scales to full.
uniform float uContentScaleX;
uniform float uContentScaleY;
// --- Toggle knob CombinedBackdrop effect (faithful to LiquidToggle.kt) ---
// The knob's backdrop is a CombinedBackdrop of:
//   1. Outer backdrop (LayerBackdrop wallpaper OR CanvasBackdrop solid color)
//   2. Scaled trackBackdrop (track color rect, scaled by gooseLerp(2/3,0.75) x gooseLerp(0,0.75))
// uUseToggleBackdrop = 1.0 → sample outer backdrop + composite scaled track color
// uUseToggleBackdrop = 0.0 → sample scene (uBackdrop) as before
//
// uUseSolidBackdrop = 1.0 → outer backdrop is solid color (uSolidBackdropColor)
// uUseSolidBackdrop = 0.0 → outer backdrop is wallpaper texture (uWallpaperSampler)
// Faithful to ToggleContent.kt:
//   - t1 (on wallpaper): backdrop = LayerBackdrop → sample wallpaper texture
//   - t2 (on card):      backdrop = rememberCanvasBackdrop { drawRect(color) } → solid color
uniform float uUseToggleBackdrop;
uniform float uUseSolidBackdrop;
uniform vec4  uSolidBackdropColor;  // rgba 0..1; used when uUseSolidBackdrop = 1.0
uniform vec4  uTrackColor;        // rgba 0..1; alpha 0 = no track color
uniform vec4  uTrackRect;         // (centerX, centerY, halfW, halfH) in canvas px (dpr-scaled)
uniform float uTrackCornerRadius; // canvas px (dpr-scaled)
// --- Bottom tab 指示器 CombinedBackdrop (faithful to LiquidBottomTabs.kt) ---
// The 指示器's backdrop = CombinedBackdrop(wallpaper, 内层背景板) where
// 内层背景板 (tabsBackdrop) is a hidden Row with ColorFilter.tint(accentColor). Only the
// opaque 标签内容 (icons/labels) becomes blue after tint — the glass part
// is transparent. We pass up to 8 tab content rects; pixels inside any rect
// (clipped to the 容器 capsule) are tinted accentColor.
uniform float uIndicatorBackdrop;    // 0 or 1
uniform vec4  uContainerRect;        // (centerX, centerY, halfW, halfH) in canvas px (dpr-scaled)
uniform float uContainerCornerRadius; // canvas px (dpr-scaled)
uniform vec4  uIndicatorAccent;      // (r, g, b, a) — accentColor + unused
uniform float uInsetPx;              // indicator backdrop inset in device px (4dp * dpr)
uniform float uIndicatorPressProgress; // 0..1 press progress (for 2nd-layer scale)
uniform float uIndicatorPanelOffset; // panel offset in device px (2nd-layer x translation)
uniform float uDpr;                 // device pixel ratio (for dp→px conversion)
uniform vec2  uContainerCenter;      // container center (scale origin) in canvas px (dpr-scaled)
uniform float uContainerScale;       // container layerBlock scale (1 + 16dp/width * pressProgress)
// Tab content fgTextures (icon+label alpha masks) for blue tint. Up to 8 tabs.
// Only opaque icon/label pixels become blue — the container glass stays natural.
uniform sampler2D uTabContentTex0;
uniform sampler2D uTabContentTex1;
uniform sampler2D uTabContentTex2;
uniform sampler2D uTabContentTex3;
uniform sampler2D uTabContentTex4;
uniform sampler2D uTabContentTex5;
uniform sampler2D uTabContentTex6;
uniform sampler2D uTabContentTex7;
uniform vec4  uTabContentRects[8];   // (centerX, centerY, halfW, halfH) per tab, canvas px (dpr-scaled)
uniform float uTabContentCount;      // number of valid tab rects (0..8)
uniform sampler2D uTabsGlassLayer;   // scene snapshot BEFORE tab-content (wallpaper+glass only, no text)
// --- SDF texture glass (faithful to SdfShader.kt) ---
uniform sampler2D uSdfTexSampler;   // clock_sdf texture (R=SDF, GB=normal, A=shape alpha)
uniform float uUseSdfTexture;       // 0 or 1
uniform vec2  uSdfTexSize;          // texture natural dimensions (px)
uniform float uSdfLightAngle;       // bevel light angle (degrees)
uniform float uEnterAlpha;          // global element alpha (enterProgress, 0..1)
// When 1.0, skip applyColorControls in the element shader (colorControls was
// already applied as a fullscreen pass BEFORE the 2-pass blur on the backdrop
// FBO, matching the original's colorControls→blur→lens order). Used by
// backdropFbo + useSeparableBlur elements (dialog card).
uniform float uSkipColorControls;   // 0 or 1
// --- Magnifier glass (faithful to MagnifierContent.kt) ---
uniform float uUseMagnifier;        // 0 or 1
uniform float uMagnifierZoom;       // zoom factor (1.5)
uniform float uMagnifierOffsetY;    // sample Y offset to cursor (80dp, device px)
// --- Sample wallpaper directly (bypass scene FBO) ---
// When 1.0, sampleBackdrop uses coverUv + uWallpaperSampler (clean wallpaper)
// instead of sceneUv + uBackdrop (scene FBO). Used by elements that sit over
// a scrim/dim (Dialog card, ControlCenter tiles) so the glass refracts the
// clean wallpaper instead of the alpha-decayed scene FBO. Faithful to the
// original where LayerBackdrop captures the wallpaper Image (alpha=1).
uniform float uSampleWallpaper;     // 0 or 1
// --- Scrim color (applied to the wallpaper BEFORE colorControls/blur/lens) ---
// Faithful to DialogContent.kt / ControlCenterContent.kt where the scrim
// (drawRect(dimColor)) is painted onto the wallpaper Image (via
// BackdropDemoScaffold's modifier = drawWithContent { drawContent(); drawRect(dimColor) }),
// so the LayerBackdrop captures wallpaper+scrim as one opaque layer.
// In the port, when uSampleWallpaper=1 (clean wallpaper), we apply the scrim
// here in the shader to replicate that composited backdrop. uScrimColor.a=0
// means no scrim. Applied as SrcOver: backdrop.rgb = scrim.rgb*scrim.a + backdrop.rgb*(1-scrim.a).
uniform vec4 uScrimColor;           // rgba 0..1; a=0 = no scrim
`;function o(e){let t=[];if(e<=1)return t.push({x:0,y:0,w:1}),t;let n=Math.PI*(3-Math.sqrt(5)),r=0;for(let i=0;i<e;i++){let a=(i+.5)/e,o=3*Math.sqrt(a),s=i*n,c=o*Math.cos(s),l=o*Math.sin(s),u=c*c+l*l,d=Math.exp(-.5*u);t.push({x:c,y:l,w:d}),r+=d}if(r>0)for(let e of t)e.w/=r;return t}function s(e,t,n,r){if(e.length===1)return`    return texture2D(${t}, ${n});
`;let i=``;for(let a of e){let e=a.x.toFixed(6),o=a.y.toFixed(6),s=a.w.toFixed(8);i+=`    sum += texture2D(${t}, ${n} + vec2(${e}, ${o}) * ${r}) * ${s};
`}return i}var c=16;function l(e=c){let t=o(e),n=s(t,`uBackdrop`,`uv`,`pxToUv`),r=s(t,`uWallpaperSampler`,`uv`,`pxToUv`);return`
// Forward declarations \u2014 blendHue/rgb2hsv/hsv2rgb are defined later but used
// by sampleIndicatorBackdrop (which must come before sampleToggleBackdrop in
// the file for readability). GLSL ES 1.00 requires declaration before use.
vec3 rgb2hsv(vec3 c);
vec3 hsv2rgb(vec3 c);
vec3 blendHue(vec3 dst, vec3 src);

float circleMap(float x) {
    return 1.0 - sqrt(1.0 - x * x);
}

// SDF-texture glass sampling (faithful to SdfShader.kt).
// Samples the clock_sdf texture at element-local coords.
// Returns vec4(intensity, maskAlpha, normalX, normalY); zeroes if outside.
vec4 sampleSdfTexture(vec2 localPx) {
    vec2 uv = vec2(localPx.x / uOriginalSize.x,
                   localPx.y / uOriginalSize.y);
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
        return vec4(0.0);
    }
    vec4 v = texture2D(uSdfTexSampler, uv);
    float sd = v.r * 2.0 - 1.0;
    float mask = smoothstep(0.5, 1.0, v.a);
    if (mask <= 0.0) return vec4(0.0);
    if (mask < 1.0) sd = 0.0;
    vec2 normal = normalize(v.gb * 2.0 - 1.0);
    float intensity = circleMap(1.0 - min(1.0, -sd * 1.5));
    return vec4(intensity, mask, normal.x, normal.y);
}

// Convert a canvas-pixel coordinate (top-left origin) to scene-texture UV.
// The scene texture is the same size as the canvas, and is rendered with
// gl_FragCoord (bottom-left origin). So UV = (canvasPx.x / canvasW, 1 -
// canvasPx.y / canvasH). The Y flip happens here so the rest of the shader
// can work in top-left-origin canvas px.
vec2 sceneUv(vec2 canvasPx) {
    return vec2(canvasPx.x / uCanvasSize.x, 1.0 - canvasPx.y / uCanvasSize.y);
}

// Gaussian disc blur \u2014 ${e} taps, dynamically generated in JS.
// Offsets are in units of radius (sigma = radius), scaled at runtime.
// radius < 0.5 falls back to single tap (no visible blur).
//
// When uSampleWallpaper > 0.5, samples the CLEAN wallpaper (uWallpaperSampler
// via coverUv) instead of the scene FBO (uBackdrop via sceneUv), AND applies
// the scrim (uScrimColor) to replicate the original's wallpaper+scrim composited
// LayerBackdrop. The scrim is applied INSIDE sampleBackdrop so EVERY sampling
// site \u2014 the initial backdrop sample, the refraction re-sample, and each
// chromatic-aberration channel \u2014 gets the same wallpaper+scrim composite.
// This fixes the "scrim not applied at edges" bug where the refraction band
// re-sampled the clean wallpaper (without scrim), making the edge brighter
// than the interior.
vec4 sampleBackdrop(vec2 canvasPx, float radius) {
    if (uSampleWallpaper > 0.5) {
        vec2 uv = coverUv(canvasPx);
        vec4 c;
        if (radius < 0.5) {
            c = texture2D(uWallpaperSampler, uv);
        } else {
            vec2 pxToUv = radius * canvasPxToUvScale();
            vec4 sum = vec4(0.0);
${r}            c = sum;
        }
        // Apply scrim (SrcOver) so the backdrop = wallpaper+scrim, opaque.
        if (uScrimColor.a > 0.001) {
            c.rgb = uScrimColor.rgb * uScrimColor.a + c.rgb * (1.0 - uScrimColor.a);
            c.a = 1.0;
        }
        return c;
    }
    vec2 uv = sceneUv(canvasPx);
    if (radius < 0.5) {
        return texture2D(uBackdrop, uv);
    }
    vec2 pxToUv = radius / uCanvasSize;
    vec4 sum = vec4(0.0);
${n}    return sum;
}

// Gaussian disc blur of the WALLPAPER (uWallpaperSampler via coverUv).
// Used by the SDF-texture glass path (LockScreen) \u2014 faithful to the original's
// blur(2dp) effect applied before the SDF shader.
vec4 sampleWallpaperBlurred(vec2 canvasPx, float radius) {
    vec2 uv = coverUv(canvasPx);
    if (radius < 0.5) {
        return texture2D(uWallpaperSampler, uv);
    }
    vec2 pxToUv = radius * canvasPxToUvScale();
    vec4 sum = vec4(0.0);
${r}    return sum;
}

// --- Toggle knob CombinedBackdrop sampling (faithful to LiquidToggle.kt) ---
// The knob's backdrop is a CombinedBackdrop of:
//   1. Outer backdrop:
//      - LayerBackdrop (wallpaper) for t1 \u2192 sample uWallpaperSampler
//      - CanvasBackdrop (solid color) for t2 \u2192 use uSolidBackdropColor
//   2. Scaled trackBackdrop (track color rect, clipped to Capsule, scaled
//      by gooseLerp(2/3, 0.75, pressProgress) x gooseLerp(0, 0.75, pressProgress)
//      around the knob's center)
//
// This function samples the outer backdrop (wallpaper OR solid color) with blur,
// then composites the scaled track color on top using a rounded-rect SDF
// at the uTrackRect position (center + half-size + corner radius).
//
// The track color SDF is also blurred by approximating the blur as a
// smoothstep over uBlurRadius \u2014 this matches the original where the blur
// effect is applied to the CombinedBackdrop (outer + track color).
vec4 sampleToggleBackdrop(vec2 canvasPx, float radius) {
    // 1. Sample outer backdrop with blur.
    vec4 wp;
    if (uUseSolidBackdrop > 0.5) {
        // CanvasBackdrop case (t2): solid color fills the entire knob area.
        // Faithful to: rememberCanvasBackdrop { drawRect(backgroundColor) }
        // The drawRect fills the DrawScope (knob's bounds) with the color,
        // so every pixel of the knob's backdrop is the solid color.
        wp = uSolidBackdropColor;
    } else if (radius < 0.5) {
        // LayerBackdrop case (t1): sample wallpaper texture unscaled.
        // IMPORTANT: use coverUv (cover-fit) to match the wallpaper background
        // pass (WALLPAPER_FRAGMENT_SHADER). Using sceneUv (raw normalization)
        // here would sample the wrong texel when the wallpaper aspect ratio
        // differs from the canvas \u2014 causing the knob to see a shifted/misaligned
        // wallpaper that doesn't match what's displayed behind it.
        vec2 uv = coverUv(canvasPx);
        wp = texture2D(uWallpaperSampler, uv);
    } else {
        // LayerBackdrop case (t1) with blur: 9-tap poisson disc on wallpaper.
        // Use coverUv for the center sample, and convert the blur radius from
        // canvas px to UV-space using canvasPxToUvScale() (which accounts for
        // the cover-fit aspect ratio cropping).
        vec2 uv = coverUv(canvasPx);
        vec2 pxToUv = radius * canvasPxToUvScale();
        vec4 sum = vec4(0.0);
        float total = 0.0;
        sum += texture2D(uWallpaperSampler, uv) * 0.25; total += 0.25;
        sum += texture2D(uWallpaperSampler, uv + vec2( 1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2(-1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000,  1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000, -1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        wp = sum / total;
    }

    // 2. Composite scaled track color on top.
    // The track rect is centered at uTrackRect.xy with half-size uTrackRect.zw,
    // and corner radius uTrackCornerRadius. We compute the SDF of this
    // rounded rect at canvasPx, then apply a smoothstep for edge AA + blur.
    // If uTrackColor.a == 0.0 OR the track rect is degenerate (halfW or
    // halfH < 0.5px, which happens at rest when scaleY=0), skip compositing.
    // Faithful to original: scale(scaleX, 0) { drawRect() } draws nothing.
    if (uTrackColor.a > 0.001 && uTrackRect.z > 0.5 && uTrackRect.w > 0.5) {
        vec2 trackCenter = uTrackRect.xy;
        vec2 trackHalf = uTrackRect.zw;
        vec2 trackLocal = canvasPx - trackCenter;
        // sdRoundedRect expects centered coord (relative to center).
        // Use uniform corner radius = uTrackCornerRadius.
        float tr = uTrackCornerRadius;
        // Approximate the rounded-rect SDF (matches sdRoundedRect from SDF_GLSL).
        vec2 q = abs(trackLocal) - trackHalf + vec2(tr);
        float trackSd = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - tr;
        // Blur the edge by uBlurRadius (approximate Gaussian edge feather).
        // Inside (trackSd < -radius) \u2192 mask=1; outside (trackSd > radius) \u2192 mask=0.
        float mask = 1.0 - smoothstep(-radius, radius, trackSd);
        // Composite: srcOver (track color over outer backdrop).
        float a = mask * uTrackColor.a;
        wp.rgb = mix(wp.rgb, uTrackColor.rgb, a);
        wp.a = mix(wp.a, 1.0, a);
    }
    return wp;
}

// sampleIndicatorBackdrop \u2014 faithful to LiquidBottomTabs.kt indicator.
//
// Naming convention (used throughout the bottom-tabs code):
//   - \u5BB9\u5668 (Container)  = outer visible glass bar (64dp), Container Row in Kotlin
//   - \u6307\u793A\u5668 (Indicator) = selected sliding glass capsule (56dp), Indicator Box in Kotlin
//   - \u5185\u5C42\u80CC\u666F\u677F (Inner backdrop) = hidden 56dp glass captured by tabsBackdrop,
//     tinted blue by ColorFilter.tint(accentColor), sampled by the indicator
//   - \u6807\u7B7E\u5185\u5BB9 (Tab content) = icon + label inside each tab slot
//
// Original: indicator.drawBackdrop(backdrop = rememberCombinedBackdrop(backdrop, tabsBackdrop))
//   - backdrop (outer) = LayerBackdrop = wallpaper (sampled via coverUv)
//   - tabsBackdrop (inner) = hidden Row's 56dp glass, inset 4dp from the
//     indicator's draw area on all sides.
//
// Implementation (mirrors sampleToggleBackdrop):
//   1. Sample wallpaper (outer backdrop) with blur \u2014 same as toggle's outer.
//   2. Composite the scene FBO (uBackdrop = container glass + content)
//      inside an INSET capsule SDF (containerRect shrunk 4dp each side).
//      This is the "smaller background plate" refracted inside the indicator.
vec4 sampleIndicatorBackdrop(vec2 canvasPx, float radius) {
    // 1. Sample wallpaper (outer LayerBackdrop) via coverUv (cover-fit).
    vec4 wp;
    if (radius < 0.5) {
        vec2 uv = coverUv(canvasPx);
        wp = texture2D(uWallpaperSampler, uv);
    } else {
        vec2 uv = coverUv(canvasPx);
        vec2 pxToUv = radius * canvasPxToUvScale();
        vec4 sum = vec4(0.0);
        float total = 0.0;
        sum += texture2D(uWallpaperSampler, uv) * 0.25; total += 0.25;
        sum += texture2D(uWallpaperSampler, uv + vec2( 1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2(-1.000,  0.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000,  1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.000, -1.000) * pxToUv) * 0.12; total += 0.12;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2( 0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707,  0.707) * pxToUv) * 0.0675; total += 0.0675;
        sum += texture2D(uWallpaperSampler, uv + vec2(-0.707, -0.707) * pxToUv) * 0.0675; total += 0.0675;
        wp = sum / total;
    }

    // 2. \u5185\u5C42\u80CC\u666F\u677F (Inner backdrop) SDF \u2014 the hidden Row's 56dp glass capsule.
    //    Faithful to LiquidBottomTabs.kt: the hidden Row has NO layerBlock,
    //    so its glass does NOT scale with the container. Only panelOffset
    //    shifts it (translationX = panelOffset).
    vec2 capsuleHalf = max(uContainerRect.zw, vec2(0.0));
    float cr = max(uContainerCornerRadius, 0.0);
    // Center = rectCenter + panelOffset (NO container scale).
    vec2 scaledCenter = uContainerRect.xy + vec2(uIndicatorPanelOffset, 0.0);
    vec2 capsuleLocal = canvasPx - scaledCenter;
    vec2 cq = abs(capsuleLocal) - capsuleHalf + vec2(cr);
    float capsuleSd = length(max(cq, vec2(0.0))) + min(max(cq.x, cq.y), 0.0) - cr;
    float mask = 1.0 - smoothstep(-radius, radius, capsuleSd);

    // 3. Sample the GLASS LAYER FBO (wallpaper + container glass, NO tab text).
    //    This is a snapshot taken after the container glass is rendered but
    //    before tab-content is drawn \u2014 so it has no white/black text to bleed
    //    through. The blue tab text is drawn on top via fgTexture (step 4).
    vec2 sceneUv2 = sceneUv(canvasPx - vec2(uIndicatorPanelOffset, 0.0));
    vec4 scene = texture2D(uTabsGlassLayer, sceneUv2);

    // 4. Draw blue \u6807\u7B7E\u5185\u5BB9 (tab content: icons/labels) on top of the glass layer.
    //    Use each tab's fgTexture alpha as a hard mask (step) \u2014 pixels inside
    //    the icon/label shape become blue, everything else stays the glass
    //    layer's natural color. No white edges (hard replace, no mix).
    //    Faithful to LiquidBottomTabs.kt: the hidden Row's tab content gets
    //    LocalLiquidBottomTabScale = gooseLerp(1, 1.2, pressProgress) + panelOffset
    //    (NOT the container scale \u2014 the hidden Row is a sibling of the
    //    container, not a child, so the container layerBlock doesn't apply).
    float contentScale = 1.0 + 0.2 * uIndicatorPressProgress;
    float tabMask = 0.0;
    for (int i = 0; i < 8; i++) {
        if (float(i) >= uTabContentCount) break;
        vec4 r = uTabContentRects[i];
        if (r.z > 0.5 && r.w > 0.5) {
            // Tab content scales around its OWN center (not container center)
            // by contentScale, then shifts by panelOffset.
            vec2 tabCenter = r.xy + vec2(uIndicatorPanelOffset, 0.0);
            vec2 scaledHalf = r.zw * contentScale;
            vec2 localPx = canvasPx - (tabCenter - scaledHalf);
            vec2 uv = localPx / (scaledHalf * 2.0);
            if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
                float a = 0.0;
                if (i == 0) a = texture2D(uTabContentTex0, uv).a;
                else if (i == 1) a = texture2D(uTabContentTex1, uv).a;
                else if (i == 2) a = texture2D(uTabContentTex2, uv).a;
                else if (i == 3) a = texture2D(uTabContentTex3, uv).a;
                else if (i == 4) a = texture2D(uTabContentTex4, uv).a;
                else if (i == 5) a = texture2D(uTabContentTex5, uv).a;
                else if (i == 6) a = texture2D(uTabContentTex6, uv).a;
                else if (i == 7) a = texture2D(uTabContentTex7, uv).a;
                tabMask = max(tabMask, a);
            }
        }
    }
    // Use fgTexture alpha directly as the blue compositing factor. fgTexture
    // is LINEAR-filtered so its alpha has smooth AA edges \u2014 no smoothstep
    // threshold needed (which caused jaggies by hard-clipping the AA gradient).
    vec3 sceneColor = mix(scene.rgb, uIndicatorAccent.rgb, tabMask);

    // 5. Composite scene over wallpaper inside the inset capsule (SrcOver).
    float a = scene.a * mask;
    vec3 resultRgb = mix(wp.rgb, sceneColor, a);

    // 6. \u5185\u5C42\u80CC\u666F\u677F rim highlight \u2014 faithful to LiquidBottomTabs.kt hidden Row:
    //    highlight = { Highlight.Default.copy(alpha = progress) }
    //    The HighlightModifier draws a STROKE (width=0.5dp, strokeWidth=2px)
    //    blurred by 0.25dp, clipped inside the capsule, colored by the
    //    DefaultHighlightShaderString AGSL shader:
    //      float2 grad = gradSdRoundedRect(centeredCoord, halfSize, gradRadius);
    //      float2 normal = float2(cos(angle), sin(angle));
    //      float d = dot(grad, normal);
    //      float intensity = pow(abs(d), falloff);
    //      return color * intensity;   // color = White(1.0), alpha=1*progress
    //    with angle=45\xB0, falloff=1, gradRadius = min(radius*1.5, min(halfW, halfH)).
    //    The stroke's outward half (capsuleSd > 0) is clipped, leaving the inner
    //    half. Final contribution = White(1.0) * intensity * strokeMask * progress,
    //    added with Plus blend (additive).
    //    NOTE: this is the SAME as the \u6307\u793A\u5668's own rim highlight (step 2f in
    //    post-passes) \u2014 both use Highlight.Default. The only difference is the
    //    SDF: here it's the \u5185\u5C42\u80CC\u666F\u677F capsule (inset 4dp), there it's the
    //    \u6307\u793A\u5668's own capsule. The shader math is identical.
    float highlightAlpha = uIndicatorPressProgress;
    if (highlightAlpha > 0.001) {
        // SDF gradient + Default highlight intensity (angle=45\xB0, falloff=1).
        float indRadius = max(cr, 0.0);
        float indHalfMin = min(capsuleHalf.x, capsuleHalf.y);
        float gradRadius = min(indRadius * 1.5, indHalfMin);
        vec2 grad = gradSdRoundedRect(capsuleLocal, capsuleHalf, gradRadius);
        vec2 normal = vec2(0.70710678, 0.70710678); // cos(45\xB0), sin(45\xB0)
        float d = dot(grad, normal);
        float intensity = pow(abs(d), 1.0);

        // Stroke mask \u2014 faithful to HighlightModifier.kt + BlurMaskFilter:
        //   paint.style = Stroke
        //   paint.strokeWidth = ceil(0.5dp * dpr) * 2  (device px)
        //   paint.blur(0.25dp * dpr)  \u2192 BlurMaskFilter(NORMAL, sigma=0.25*dpr)
        //   canvas.clipOutline \u2192 clip to INSIDE (capsuleSd <= 0)
        // In Skia/Android, BlurMaskFilter's radius param IS the Gaussian sigma.
        // capsuleSd is in device px (uContainerRect is dpr-scaled), so sigma
        // and strokeHalf must also be in device px.
        // Implementation: hard-edge stroke band convolved with Gaussian kernel
        // via adaptive SDF sampling (same approach as highlight.ts). Fixed 1px
        // tap spacing \u2014 tap count scales with sigma (2*ceil(3\u03C3)+1, max 64).
        float strokeHalf = ceil(0.5 * uDpr) * 2.0 * 0.5;  // = ceil(0.5*dpr)
        float sigma2 = max(0.25 * uDpr, 0.1);  // blurRadius = 0.25dp, sigma = blurRadius*dpr
        float tapSpacing2 = 1.0; // fixed 1px \u2014 tap count scales with sigma
        float threeSigma2 = sigma2 * 3.0;
        float strokeMask = 0.0;
        float wSum2 = 0.0;
        for (int j = -32; j <= 32; j++) {
            float offset = float(j) * tapSpacing2;
            if (abs(offset) <= threeSigma2) {
                float sampleSd = capsuleSd - offset;
                float hard = (abs(sampleSd) < strokeHalf) ? 1.0 : 0.0;
                float w = exp(-0.5 * (offset * offset) / (sigma2 * sigma2));
                strokeMask += hard * w;
                wSum2 += w;
            }
        }
        strokeMask /= wSum2;
        strokeMask *= 0.5;  // clip halves the symmetric stroke at the edge
        // Clip to inside (outside the \u5185\u5C42\u80CC\u666F\u677F \u2192 no highlight)
        strokeMask = (capsuleSd > 0.0) ? 0.0 : strokeMask;

        // White(1.0) * intensity * strokeMask * progress, Plus blend (additive).
        // (color.copy(alpha=1) * highlightLayer.alpha=progress \u2014 the 0.5 alpha
        // in HighlightStyle.Default.color is NOT used; the AGSL shader uses
        // color.copy(alpha=1f) and the layer alpha is highlight.alpha=progress.)
        resultRgb += vec3(1.0) * intensity * strokeMask * highlightAlpha;
    }

    return vec4(resultRgb, 1.0);
}

// Magnifier backdrop sampling \u2014 faithful to MagnifierContent.kt's
// onDrawBackdrop: withTransform({ scale(1.5); translate(top=-80dp) }, drawBackdrop).
// Zoom around the magnifier center, then offset Y toward cursor.
vec4 sampleMagnifier(vec2 canvasPx, float radius) {
    vec2 magCenter = uElementOffset + uElementSize * 0.5;
    vec2 zoomedCoord = magCenter + (canvasPx - magCenter) / uMagnifierZoom;
    vec2 cursorCoord = vec2(zoomedCoord.x, zoomedCoord.y + uMagnifierOffsetY);
    return sampleBackdrop(cursorCoord, radius);
}

// colorControls \u2014 exact port of ColorFilter.kt colorControlsColorFilter.
// saturation 1.5, brightness 0, contrast 1 -> pure saturation boost.
vec3 applyColorControls(vec3 c, float brightness, float contrast, float saturation) {
    float invSat = 1.0 - saturation;
    float r = 0.213 * invSat;
    float g = 0.715 * invSat;
    float b = 0.072 * invSat;
    float t = (0.5 - contrast * 0.5 + brightness) * 255.0;
    float cs = contrast * saturation;
    float cr = contrast * r;
    float cg = contrast * g;
    float cb = contrast * b;
    vec3 outc;
    outc.r = (cr + cs) * c.r + cg * c.g + cb * c.b + t / 255.0;
    outc.g = cr * c.r + (cg + cs) * c.g + cb * c.b + t / 255.0;
    outc.b = cr * c.r + cg * c.g + (cb + cs) * c.b + t / 255.0;
    return outc;
}

// --- HSV conversion + BlendMode.Hue ---------------------------
// Faithful port of Skia's BlendMode.Hue (non-separable blend).
// Hue blend: result takes hue from src, saturation+value from dst.
// Used by drawRect(tint, BlendMode.Hue) in onDrawSurface.
vec3 rgb2hsv(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float delta = maxC - minC;
    float v = maxC;
    float s = maxC < 1e-6 ? 0.0 : delta / maxC;
    float h = 0.0;
    if (delta > 1e-6) {
        if (maxC == c.r) {
            h = mod((c.g - c.b) / delta, 6.0);
        } else if (maxC == c.g) {
            h = (c.b - c.r) / delta + 2.0;
        } else {
            h = (c.r - c.g) / delta + 4.0;
        }
        h *= 60.0;
        if (h < 0.0) h += 360.0;
    }
    return vec3(h / 360.0, s, v);
}

vec3 hsv2rgb(vec3 c) {
    float h = c.x * 6.0;
    float s = c.y;
    float v = c.z;
    float i = floor(h);
    float f = h - i;
    float p = v * (1.0 - s);
    float q = v * (1.0 - s * f);
    float t = v * (1.0 - s * (1.0 - f));
    i = mod(i, 6.0);
    if (i < 1.0) return vec3(v, t, p);
    if (i < 2.0) return vec3(q, v, p);
    if (i < 3.0) return vec3(p, v, t);
    if (i < 4.0) return vec3(p, q, v);
    if (i < 5.0) return vec3(t, p, v);
    return vec3(v, p, q);
}

// BlendMode.Hue: take hue from src, sat+val from dst.
vec3 blendHue(vec3 dst, vec3 src) {
    vec3 dh = rgb2hsv(dst);
    vec3 sh = rgb2hsv(src);
    return hsv2rgb(vec3(sh.x, dh.y, dh.z));
}
`}function u(e=c){return`
// Enable derivative functions (fwidth) for adaptive edge anti-aliasing.
// No-op on WebGL2; required on WebGL1 via OES_standard_derivatives.
#extension GL_OES_standard_derivatives : enable

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

${a}

${r}

${i}

${l(e)}

void main() {
    // gl_FragCoord origin is bottom-left in WebGL; flip to top-left.
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    // Content scale (non-uniform): when < 1.0, compress the backdrop UV toward
    // the element center. Faithful to LiquidToggle.kt / LiquidSlider.kt:
    //   scale(scaleX, scaleY) { drawBackdrop() }
    // At rest (progress=0), Y scale = 0 \u2192 degenerate (single horizontal line),
    // but the white overlay hides it. When pressed, scales to full.
    vec2 contentScale = vec2(uContentScaleX, uContentScaleY);
    vec2 sampleCoord = screenCoord;
    if (uContentScaleX < 0.999 || uContentScaleY < 0.999) {
        vec2 elementCenter = uElementOffset + uElementSize * 0.5;
        sampleCoord = elementCenter + (screenCoord - elementCenter) * contentScale;
    }

    // --- ORIGINAL-SPACE SDF (faithful to graphicsLayer { scaleX, scaleY }) ---
    // The original applies the refraction shader at the ORIGINAL element size,
    // THEN scales the entire rendered layer by (scaleX, scaleY). To replicate
    // this in a single-pass shader, we:
    //   1. Compute the centered coord in SCREEN space (relative to element center)
    //   2. Divide by uLayerScale to map back to ORIGINAL space
    //   3. Compute SDF/refraction in ORIGINAL space (shape is correct, not stretched)
    //   4. Map the refraction offset back to SCREEN space for backdrop sampling
    //      (offset_screen = offset_orig * uLayerScale)
    //
    // elementCenter is the SAME for scaled and original rects (scaling is around
    // the center), so uElementOffset + uElementSize*0.5 gives the correct center.
    vec2 elementCenter = uElementOffset + uElementSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    // Map to original space (guard against divide-by-zero).
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    // Apply element rotation (graphicsLayer rotationZ). Un-rotate the sample
    // coord into the element's local space so the SDF shape appears rotated
    // by +rotation. The layer is rotated AFTER shading, so we shade in local
    // (un-rotated) space. Refraction offsets computed in local space are
    // rotated BACK to screen space (by +rotation) before sampling the backdrop.
    float rot = uElementRotation;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -rot);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // --- SDF-texture glass path (faithful to SdfShader.kt) ---
    if (uUseSdfTexture > 0.5) {
        vec2 localPx = centeredOrigRot + uOriginalSize * 0.5;
        vec4 sdfData = sampleSdfTexture(localPx);
        if (sdfData.y <= 0.0) discard;
        float intensity = sdfData.x;
        float sdfMask = sdfData.y;
        vec2 normal = sdfData.zw;

        // Sample the WALLPAPER directly (not the scene FBO) \u2014 faithful to
        // LockScreenContent.kt's drawPlainBackdrop which uses the LayerBackdrop
        // (raw wallpaper, before the dark scrim is drawn).
        // The original applies blur(2dp) BEFORE the SDF shader (in the effects
        // block), so 'content' (the SDF shader's input) is already blurred.
        // We replicate by sampling the wallpaper with a 9-tap poisson blur at
        // the refracted coordinate.
        vec2 refractedOffsetOrig = intensity * uRefractionHeight * normal;
        vec2 refractedOffsetScreen = refractedOffsetOrig * layerScale;
        vec2 refractedScreen = screenCoord - refractedOffsetScreen;

        // Faithful to SdfShader.kt: color = content.eval(refractedCoord) * v.a
        // The content is the wallpaper after colorControls + blur(2dp).
        // FAITHFUL ORDERING: the original's onDrawBackdrop draws the wallpaper
        // AND drawRect(White 0.25) into the same buffer, THEN applies the
        // RenderEffect chain (colorControls, blur, SDF shader). So the white
        // overlay is PART of the SDF shader content input, and colorControls
        // is applied to the COMBINED (wallpaper + white) buffer.
        // We replicate: mix white into raw wallpaper FIRST, then apply
        // colorControls \u2014 so colorControls darkens the white too (matching
        // the original where contrast=0.75, brightness=-0.1 dims the white).
        vec4 content = sampleWallpaperBlurred(refractedScreen, uBlurRadius);
        vec3 rawContent = content.rgb;
        // Mix in white overlay (White 0.25 SrcOver) on RAW wallpaper first.
        if (uSurfaceColor.a > 0.001) {
            rawContent = uSurfaceColor.rgb * uSurfaceColor.a + rawContent * (1.0 - uSurfaceColor.a);
        }
        // THEN apply colorControls to the combined buffer.
        vec3 contentColor = applyColorControls(rawContent, uBrightness, uContrast, uSaturation);
        // Multiply by sdfMask (v.a) \u2014 faithful to content * v.a.
        vec3 color = contentColor * sdfMask;

        // Bevel lighting
        float angleRad = uSdfLightAngle * 3.1415926 / 180.0;
        vec2 lightDir = vec2(cos(angleRad), sin(angleRad));
        float bevel1 = clamp(dot(normal, lightDir), 0.0, 1.0);
        color.rgb *= 1.0 + 0.5 * intensity * bevel1;
        float bevel2 = clamp(dot(normal, -lightDir), 0.0, 1.0);
        color.rgb *= 1.0 + 0.5 * bevel2 * min(1.0, smoothstep(1.0, 0.0, abs(intensity - 0.25) * 6.0));

        gl_FragColor = vec4(color, sdfMask * uEnterAlpha);
        return;
    }

    // SDF for refraction/highlight \u2014 always analytic sdRoundedRect.
    float sd = sdShape(centeredOrigRot, origHalfSize, origRadius);
    // Clip + edgeAA: alpha mask (browser-native AA) when capsule enabled.
    float edgeAlpha;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredOrigRot, origHalfSize, origRadius);
        if (mask < 0.01) discard;
        edgeAlpha = mask;
    } else {
        if (sd > 1.5) discard;
        // \u6297\u952F\u9F7F\uFF1A\u8FC7\u6E21\u5E26\u5BBD\u5EA6\u81EA\u9002\u5E94\u5C4F\u5E55\u50CF\u7D20\uFF08\u7EA6 3 \u7269\u7406\u50CF\u7D20\uFF09\uFF0C\u534A\u900F\u660E\u73BB\u7483\u4E5F\u80FD\u770B\u6E05\u7FBD\u5316
        float aaWidth = max(fwidth(sd), 1.0) * 1.5;
        edgeAlpha = 1.0 - smoothstep(-aaWidth, aaWidth, sd);
    }

    // --- 1. Backdrop sample (before refraction) -------------------
    // Use sampleCoord (content-scaled) so the backdrop shrinks inward when
    // uContentScaleX/Y < 1.0 (toggle/slider knob press effect).
    vec4 backdrop;
    if (uIndicatorBackdrop > 0.5) {
        backdrop = sampleIndicatorBackdrop(screenCoord, uBlurRadius);
    } else if (uUseToggleBackdrop > 0.5) {
        backdrop = sampleToggleBackdrop(screenCoord, uBlurRadius);
    } else if (uUseMagnifier > 0.5) {
        backdrop = sampleMagnifier(screenCoord, uBlurRadius);
    } else {
        backdrop = sampleBackdrop(sampleCoord, uBlurRadius);
    }
    // colorControls: for backdropFbo+useSeparableBlur elements, cc was already
    // applied as a fullscreen pass BEFORE the 2-pass blur (uSkipColorControls=1),
    // matching the original's colorControls\u2192blur order. Skip here to avoid
    // double-applying. For inline-blur elements, apply here.
    vec3 color = (uSkipColorControls > 0.5) ? backdrop.rgb : applyColorControls(backdrop.rgb, uBrightness, uContrast, uSaturation);
    // Magnifier glass is always OPAQUE \u2014 faithful to the original which
    // samples rememberCombinedBackdrop (wallpaper + content + cursor all
    // composited onto the opaque wallpaper). The port's scene texture may
    // carry partial alpha (e.g. card 0.9), which would make the glass
    // translucent. Force alpha=1 for magnifier.
    float alpha = (uUseMagnifier > 0.5) ? 1.0 : backdrop.a;

    // --- 2. Lens refraction (SDF + circleMap) ---------------------
    // Faithful port of RoundedRectRefractionWithDispersionShaderString.
    // SDF/grad computed in ORIGINAL space; uRefractionHeight/Amount are in
    // original px (NOT scaled by layerScale \u2014 the original AGSL shader receives
    // the original size and the graphicsLayer scales the OUTPUT, not the params).
    // Early-out: if we're deeper than refractionHeight from the edge,
    // skip refraction entirely (the lens doesn't reach here).
    if (uRefractionHeight > 0.5 && (-sd) < uRefractionHeight) {
        float sdClamped = min(sd, 0.0);
        float d = circleMap(1.0 - (-sdClamped) / uRefractionHeight) * uRefractionAmount;

        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        // AGSL: normalize(grad + depthEffect * normalize(centeredCoord))
        vec2 depthVec = vec2(0.0);
        if (uDepthEffect > 0.5) {
            float dirLen = length(centeredOrigRot);
            if (dirLen > 1e-6) depthVec = centeredOrigRot / dirLen;
        }
        vec2 gradSum = grad + uDepthEffect * depthVec;
        float gradLen = length(gradSum);
        if (gradLen > 1e-6) grad = gradSum / gradLen;

        // Refraction offset in ORIGINAL space, then map to SCREEN space.
        //   offset_orig = d * grad          (original px)
        //   offset_screen = offset_orig * layerScale  (screen px, for sampling)
        // Faithful to: AGSL computes offset in original space, then graphicsLayer
        // scales the rendered output \u2014 so a pixel at original position p samples
        // the backdrop at p + offset_orig, and the result appears at screen
        // position center + p*layerScale. The backdrop sample position in screen
        // space is therefore center + (p + offset_orig)*layerScale
        // = screenCoord + offset_orig * layerScale.
        vec2 refractedOffsetOrig = d * grad;
        // Rotate the local-space offset BACK to screen space (by +rotation),
        // then scale by layerScale. Without the rotation, refraction points
        // in the wrong direction when the element is rotated.
        vec2 refractedOffsetScreen = rotateBy(refractedOffsetOrig, rot) * layerScale;
        vec2 refractedScreen = screenCoord + refractedOffsetScreen;
        vec2 refractedSampleCoord = refractedScreen;
        if (uIndicatorBackdrop < 0.5 && uUseToggleBackdrop < 0.5 &&
            (uContentScaleX < 0.999 || uContentScaleY < 0.999)) {
            refractedSampleCoord = elementCenter + (refractedScreen - elementCenter) * contentScale;
        }

        if (uChromaticAberration > 0.5) {
            // Faithful 7-path chromatic dispersion (ROYGBV + purple).
            // Original AGSL: dispersionIntensity = chromaticAberration * (cx*cy)/(hx*hy)
            //                dispersedCoord = d * grad * dispersionIntensity
            // 7 samples at dispersedCoord * {1, 2/3, 1/3, 0, -1/3, -2/3, -1}
            // with weighted channel accumulation.
            float dispersionIntensity = 1.0 * ((centeredOrigRot.x * centeredOrigRot.y) / (origHalfSize.x * origHalfSize.y));
            vec2 dispersedOffsetOrig = refractedOffsetOrig * dispersionIntensity;
            vec2 dispersedOffsetScreen = rotateBy(dispersedOffsetOrig, rot) * layerScale;

            // Sample helper \u2014 pick the right backdrop sampler.
            #define SAMPLE_DISPERSED(offset)                 (uIndicatorBackdrop > 0.5 ? sampleIndicatorBackdrop(refractedScreen + (offset), uBlurRadius) :                  uUseToggleBackdrop > 0.5 ? sampleToggleBackdrop(refractedScreen + (offset), uBlurRadius) :                  uUseMagnifier > 0.5 ? sampleMagnifier(refractedScreen + (offset), uBlurRadius) :                  sampleBackdrop(refractedSampleCoord + (offset), uBlurRadius))

            vec4 sRed    = SAMPLE_DISPERSED(+dispersedOffsetScreen);
            vec4 sOrange = SAMPLE_DISPERSED(+dispersedOffsetScreen * (2.0 / 3.0));
            vec4 sYellow = SAMPLE_DISPERSED(+dispersedOffsetScreen * (1.0 / 3.0));
            vec4 sGreen  = SAMPLE_DISPERSED(vec2(0.0));
            vec4 sCyan   = SAMPLE_DISPERSED(-dispersedOffsetScreen * (1.0 / 3.0));
            vec4 sBlue   = SAMPLE_DISPERSED(-dispersedOffsetScreen * (2.0 / 3.0));
            vec4 sPurple = SAMPLE_DISPERSED(-dispersedOffsetScreen);

            #undef SAMPLE_DISPERSED

            // Faithful channel weighting from the original AGSL shader.
            vec3 dispColor = vec3(0.0);
            float dispAlpha = 0.0;
            // red
            dispColor.r += sRed.r / 3.5;
            dispAlpha  += sRed.a / 7.0;
            // orange
            dispColor.r += sOrange.r / 3.5;
            dispColor.g += sOrange.g / 7.0;
            dispAlpha  += sOrange.a / 7.0;
            // yellow
            dispColor.r += sYellow.r / 3.5;
            dispColor.g += sYellow.g / 3.5;
            dispAlpha  += sYellow.a / 7.0;
            // green
            dispColor.g += sGreen.g / 3.5;
            dispAlpha  += sGreen.a / 7.0;
            // cyan
            dispColor.g += sCyan.g / 3.5;
            dispColor.b += sCyan.b / 3.0;
            dispAlpha  += sCyan.a / 7.0;
            // blue
            dispColor.b += sBlue.b / 3.0;
            dispAlpha  += sBlue.a / 7.0;
            // purple
            dispColor.r += sPurple.r / 7.0;
            dispColor.b += sPurple.b / 3.0;
            dispAlpha  += sPurple.a / 7.0;

            color = (uSkipColorControls > 0.5) ? dispColor : applyColorControls(dispColor, uBrightness, uContrast, uSaturation);
            // Magnifier chromatic aberration also forces opaque.
            alpha = (uUseMagnifier > 0.5) ? 1.0 : dispAlpha;
        } else {
            vec4 refracted;
            if (uIndicatorBackdrop > 0.5) {
                refracted = sampleIndicatorBackdrop(refractedScreen, uBlurRadius);
            } else if (uUseToggleBackdrop > 0.5) {
                refracted = sampleToggleBackdrop(refractedScreen, uBlurRadius);
            } else if (uUseMagnifier > 0.5) {
                refracted = sampleMagnifier(refractedScreen, uBlurRadius);
            } else {
                refracted = sampleBackdrop(refractedSampleCoord, uBlurRadius);
            }
            color = (uSkipColorControls > 0.5) ? refracted.rgb : applyColorControls(refracted.rgb, uBrightness, uContrast, uSaturation);
            // Magnifier refraction also forces opaque (see backdrop sample above).
            alpha = (uUseMagnifier > 0.5) ? 1.0 : refracted.a;
        }
    }

    // --- 3. onDrawSurface: tint (BlendMode.Hue + 0.75 alpha) -----
    // Faithful port of LiquidButton.kt onDrawSurface:
    //   drawRect(tint, blendMode = BlendMode.Hue)
    //   drawRect(tint.copy(alpha = 0.75f))
    // First pass: replace backdrop hue with tint hue (Hue blend, alpha = tint.a).
    // Second pass: overlay tint color at 0.75*alpha (SrcOver blend).
    if (uTintColor.a > 0.001) {
        vec3 hueBlended = blendHue(color, uTintColor.rgb);
        color = mix(color, hueBlended, uTintColor.a);
        color = mix(color, uTintColor.rgb, 0.75 * uTintColor.a);
    }

    // --- 4. onDrawSurface: surfaceColor (drawRect(surfaceColor)) --
    if (uSurfaceColor.a > 0.001) {
        color = mix(color, uSurfaceColor.rgb, uSurfaceColor.a);
    }

    // --- 5. Highlight (edge specular) -----------------------------
    // NOTE: The rim highlight is drawn as a SEPARATE pass (see
    // RIM_HIGHLIGHT_FRAGMENT_SHADER) with true Plus/SrcOver blend,
    // matching the original HighlightModifier.kt which records a separate
    // graphics layer. Doing it inline here would dim the highlight via the
    // element's edge AA, which is wrong \u2014 the highlight layer is composited
    // on top with its own blend mode.

    // --- 6. Inner shadow (REMOVED) --------------------------------
    // Moved to Step 2b post-pass: Canvas2D blurred ring mask + separate
    // INNER_SHADOW_MASK_COMPOSITE pass (true Gaussian blur, faithful to
    // InnerShadowModifier.kt's BlurEffect). The old inline SDF approximation
    // was deleted.

    // --- 7. Edge anti-aliasing -----------------------------------
    // edgeAlpha was computed earlier (mask mode: direct coverage, analytic: smoothstep).
    gl_FragColor = vec4(color, alpha * edgeAlpha * uEnterAlpha);
}
`}var d=u(c),f=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uElementOffset;   // SCALED rect top-left (where the quad is drawn)
uniform vec2  uElementSize;     // SCALED size (includes graphicsLayer scale)
uniform vec4  uCornerRadii;     // SCALED corner radii
uniform float uShadowRadius;    // ORIGINAL px (NOT scaled \u2014 faithful to BlurMaskFilter at original size)
uniform vec2  uShadowOffset;    // ORIGINAL px (offsetX, offsetY; +Y = downward)
uniform vec4  uShadowColor;     // rgba
// --- ORIGINAL-SPACE SDF (faithful to graphicsLayer { scaleX, scaleY }) ---
// Same approach as the element shader: compute the shadow SDF in ORIGINAL
// space (shape is a correct capsule, not stretched), then the graphicsLayer
// scales the entire shadow layer by (scaleX, scaleY). The shadow offset is
// in ORIGINAL px; we multiply by uLayerScale to map it to screen space for
// the SDF evaluation (offset_screen = offset_orig * layerScale). The shadow
// radius (blur sigma) stays in ORIGINAL px because the Gaussian falloff is
// computed in original space \u2014 the graphicsLayer then stretches the blurred
// result, which is the faithful behavior (BlurMaskFilter blurs at original
// resolution, then graphicsLayer scales the blurred pixels).
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer
uniform float uElementRotation;     // rotation in radians (graphicsLayer rotationZ)

${r}

void main() {
    // Flip gl_FragCoord (bottom-left origin) to top-left origin, so +Y
    // points downward \u2014 matching CSS convention.
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    // elementCenter is the SAME for scaled and original rects (scaling is
    // around the center), so uElementOffset + uElementSize*0.5 gives the
    // correct center.
    vec2 elementCenter = uElementOffset + uElementSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    // Map to ORIGINAL space (guard against divide-by-zero).
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    // Un-rotate into local space so the shadow shape rotates with the element.
    // Also rotate the shadow offset into local space so it stays consistent.
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);
    vec2 shadowOffsetRot = rotateBy(uShadowOffset, -uElementRotation);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // Shadow offset: defined in ORIGINAL px, applied in screen space.
    // The original draws the shadow at original size with this offset, then
    // graphicsLayer scales the whole layer \u2014 so the offset effectively
    // becomes offset_orig * layerScale in screen space. We map it back to
    // original space for the SDF: offset_orig = offset_screen / layerScale,
    // which cancels \u2014 so we use uShadowOffset directly in original space.
    vec2 shadowCenteredOrig = centeredOrigRot - shadowOffsetRot;
    float sd = sdShape(shadowCenteredOrig, origHalfSize, origRadius);
    // SDF of the element itself (not offset) \u2014 used to mask the shadow
    // inside the element so it doesn't bleed through the AA edge.
    float elementSd = sdShape(centeredOrigRot, origHalfSize, origRadius);

    // Shadow intensity: Gaussian falloff from the shadow shape's edge.
    // uShadowRadius is in ORIGINAL px (faithful to BlurMaskFilter at original
    // size). sigma = radius/3 matches the BlurMaskFilter spread.
    float sigma = max(uShadowRadius / 3.0, 1.0);
    float shadow = 0.5 * exp(-sd * sd / (2.0 * sigma * sigma));
    // Mask out the shadow inside the element (the element covers it).
    shadow *= smoothstep(-1.0, 1.0, elementSd);

    gl_FragColor = vec4(uShadowColor.rgb, uShadowColor.a * shadow);
}
`;`${r}`;var p=`
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;       // element top-left in canvas px (top-left origin) \u2014 SCALED rect
uniform vec2  uSize;         // element size in canvas px \u2014 SCALED
uniform vec4  uCornerRadii;  // capsule radii (topLeft, topRight, bottomRight, bottomLeft) in px \u2014 SCALED
uniform vec4  uColor;        // rgba; usually white * (alpha = 0.15 * progress)
uniform float uRadius;       // glow radius in canvas px (= minDim * 1.5, SCALED space)
uniform vec2  uPosition;     // finger position in element-local px (top-left origin, SCALED space)
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
// The press glow (InteractiveHighlight) is drawn INSIDE the graphicsLayer, so
// it is clipped to the ORIGINAL capsule shape, then scaled with the layer.
// The glow position + radius are in SCALED space (they track the finger in
// screen px), but the clip SDF is in original space so the capsule clip stays
// correct when the button is stretched.
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;

    // --- Capsule clip in ORIGINAL space (faithful to graphicsLayer clip) ---
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 origHalfSize = uOriginalSize * 0.5;
    float sd = sdShape(rotateBy(centeredOrig, -uElementRotation), origHalfSize, uOriginalCornerRadius);
    if (sd > 0.5) discard;
    float clipAlpha = 1.0 - smoothstep(-0.5, 0.5, sd);

    // Faithful AGSL port: smoothstep(radius, radius*0.5, dist) means
    // intensity = 1 at dist <= radius*0.5, fading to 0 at dist >= radius.
    // dist + uPosition are in SCALED local space (finger tracks screen px).
    float dist = distance(localCoord, uPosition);
    float intensity = smoothstep(uRadius, uRadius * 0.5, dist);

    // Premultiplied Plus-blend contribution. Renderer uses blendFunc(ONE, ONE)
    // so result.rgb = contribution + dst.rgb (clamped to 1).
    vec3 contribution = uColor.rgb * uColor.a * intensity * clipAlpha;
    gl_FragColor = vec4(contribution, 1.0);
}
`,m=`
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform vec4  uColor;
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
// The white overlay (onDrawSurface drawRect) is drawn INSIDE the graphicsLayer,
// so it is clipped to the ORIGINAL capsule shape, then scaled with the layer.
// Computing the clip SDF in original space keeps the capsule clip correct when
// the button is stretched (no corner bleed, no stretched-clip artifacts).
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 origHalfSize = uOriginalSize * 0.5;
    float sd = sdShape(rotateBy(centeredOrig, -uElementRotation), origHalfSize, uOriginalCornerRadius);
    if (sd > 0.5) discard;
    float clipAlpha = 1.0 - smoothstep(-0.5, 0.5, sd);

    gl_FragColor = vec4(uColor.rgb, uColor.a * clipAlpha);
}
`,h=`
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;          // element top-left in canvas px (top-left origin) \u2014 SCALED rect
uniform vec2  uSize;            // element size in canvas px \u2014 SCALED (includes graphicsLayer scale)
uniform vec4  uCornerRadii;     // (topLeft, topRight, bottomRight, bottomLeft) in px \u2014 SCALED
uniform vec4  uHighlightColor;  // rgb + 1.0
uniform float uHighlightAngle;  // radians
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;     // 0=Default, 1=Ambient, 2=Plain
uniform float uHighlightStrokeWidth;
uniform float uHighlightBlur;
// --- ORIGINAL-SPACE SDF (faithful to graphicsLayer { scaleX, scaleY }) ---
// Same approach as the element shader: compute SDF/stroke in ORIGINAL space
// (shape is correct, not stretched), so the highlight clip + stroke remain a
// correct capsule shape that is then scaled by graphicsLayer. Without this,
// a horizontally-stretched button would stretch the highlight clip too,
// making the stroke band uneven. See element.ts for the full rationale.
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer
uniform float uElementRotation;     // rotation in radians (graphicsLayer rotationZ)

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    // elementCenter is the SAME for scaled and original rects (scaling is
    // around the center), so uOffset + uSize*0.5 gives the correct center.
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    // Map to ORIGINAL space (guard against divide-by-zero).
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    // Un-rotate into the element's local space so the SDF shape rotates.
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // SDF for stroke \u2014 analytic sdRoundedRect (matches the pre-capsule
    // highlight implementation). When capsule is OFF, this is the exact
    // shape. When capsule is ON, this is a close approximation (circular
    // arc vs G2 Bezier \u2014 the difference is sub-pixel within the 2px stroke
    // band, invisible in the highlight).
    float sd = sdRoundedRect(centeredOrigRot, origHalfSize, origRadius);

    // Outside the shape \u2014 clip (hard discard, matching pre-capsule behavior).
    if (sd > 0.0) discard;

    // Stroke mask \u2014 faithful to HighlightModifier.kt:
    //   paint.style = Stroke
    //   paint.strokeWidth = ceil(width.toPx()) * 2     // full stroke, centered on edge
    //   paint.blur(blurRadius.toPx())                   // BlurMaskFilter, Blur.NORMAL
    //   canvas.clipOutline(outline)                     // clip to inside the shape
    //   canvas.drawOutline(outline, paint)              // stroke centered on edge
    //
    // Implementation: first compute a HARD-EDGE stroke mask (1.0 inside the
    // stroke band, 0.0 outside), then convolve it with a Gaussian kernel by
    // sampling the SDF at multiple offsets along the gradient direction.
    // This mirrors the original's two-step process (draw stroke \u2192 blur),
    // rather than using an analytic erf approximation.
    //
    // The hard stroke band: sd in [-strokeHalf, +strokeHalf].
    // After clip (sd > 0 discarded by the outer if), only [-strokeHalf, 0] shows.
    //
    // Faithful to the original BlurMaskFilter:
    //   paint.blur(blurRadius.toPx())  \u2192  BlurMaskFilter(NORMAL, sigma=blurRadius_px)
    // In Skia/Android, BlurMaskFilter's radius param IS the Gaussian sigma
    // (not radius/3). blurRadius = width/2 = 0.25dp, so sigma = 0.25*dpr px.
    // uHighlightBlur is already in device px (set by the renderer as widthDp*dpr*0.5).
    float strokeHalf = uHighlightStrokeWidth * 0.5;
    float sigma = max(uHighlightBlur, 0.1);

    // Gaussian convolution of the hard stroke mask \u2014 3-tap (\u03C3-spaced).
    // The original's BlurMaskFilter has \u03C3 = blurRadius = 0.25dp \u2192 0.25px at
    // dpr=1. At this sub-pixel sigma, only 3 taps (at -\u03C3, 0, +\u03C3) are needed
    // \u2014 the Gaussian weight at \xB12\u03C3 is exp(-2) \u2248 0.14, negligible. This
    // replaces the old 65-tap loop (which computed 65 exp() calls per pixel,
    // ~650 cycles \u2014 the single biggest shader cost). 3 taps = 3 exp() = ~30
    // cycles, a 20\xD7 reduction with identical visual result at \u03C3=0.25.
    //   hardMask(sd) = 1.0 if |sd| < strokeHalf, else 0.0
    //   blurred(sd) = \u03A3 hardMask(sd - offset_k) * gauss(offset_k, \u03C3)
    // CLIP HALVING: the stroke is centered on sd=0; clip removes sd>0 (outer
    // half), so peak \u2248 0.5. We halve to match.
    float strokeMask = 0.0;
    float wSum = 0.0;
    for (int i = -1; i <= 1; i++) {
        float offset = float(i) * sigma;  // taps at -\u03C3, 0, +\u03C3
        float sampleSd = sd - offset;
        float hard = (abs(sampleSd) < strokeHalf) ? 1.0 : 0.0;
        float w = exp(-0.5 * (offset * offset) / (sigma * sigma));
        strokeMask += hard * w;
        wSum += w;
    }
    strokeMask /= wSum;
    strokeMask *= 0.5;  // clip halves the symmetric stroke at the edge

    if (uHighlightMode < 0.5) {
        // Default \u2014 shader returns color * intensity, Plus blend.
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        float d = dot(grad, normal);
        float intensity = pow(abs(d), uHighlightFalloff);
        vec3 c = uHighlightColor.rgb * intensity * strokeMask * uHighlightAlpha;
        gl_FragColor = vec4(c, 1.0);
    } else if (uHighlightMode < 1.5) {
        // Ambient \u2014 shader returns half4(t,t,t,1.0)*intensity, SrcOver blend.
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        float d = dot(grad, normal);
        float intensity = pow(abs(d), uHighlightFalloff);
        // No step(0,d) \u2014 use full intensity on both sides (no black edge).
        float i = intensity * strokeMask * uHighlightAlpha;
        gl_FragColor = vec4(uHighlightColor.rgb * i, i);
    } else {
        // Plain \u2014 even stroke, paint.color, Plus blend.
        vec3 c = uHighlightColor.rgb * strokeMask * uHighlightAlpha;
        gl_FragColor = vec4(c, 1.0);
    }
}
`,g=`
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;          // element top-left (top-left origin) \u2014 SCALED
uniform vec2  uSize;            // element size \u2014 SCALED
uniform vec4  uCornerRadii;     // SCALED
uniform float uHighlightStrokeWidth;  // ceil(width*dpr)*2, device px
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;
// uCornerStyle, uUseContinuousSdf, uContinuousSdf, uContinuousSdfTexSize,
// uContinuousSdfElementSize are declared in SDF_GLSL (do NOT redeclare here).

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    float sd = sdShape(centeredOrigRot, origHalfSize, origRadius);

    // clipOutline \u2014 clip to INSIDE the shape. Outside (sd > 0) is discarded.
    float edgeAA;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredOrigRot, origHalfSize, origRadius);
        if (mask < 0.01) discard;
        edgeAA = mask;
    } else {
        if (sd > 1.0) discard;
        float aaWidth = max(fwidth(sd), 1.0) * 1.5;
        edgeAA = 1.0 - smoothstep(-aaWidth, aaWidth, sd);
    }

    // Stroke band centered on the edge (sd = 0), with 0.5px coverage AA on
    // the inner boundary. The outer boundary (sd = +strokeHalf) is clipped
    // away by edgeAA above. Faithful to Skia Paint.Stroke's coverage AA.
    // The BlurMaskFilter pass (when sigma >= 0.5px) softens this further;
    // at sub-pixel sigma (0.25px) the blur is skipped and this 0.5px AA
    // is what matches the original's look (Skia's 0.25px blur is negligibly
    // soft \u2014 essentially just AA).
    float strokeHalf = uHighlightStrokeWidth * 0.5;
    float strokeAAWidth = max(fwidth(sd), 1.0) * 1.5;
    float strokeAA = 1.0 - smoothstep(strokeHalf - strokeAAWidth, strokeHalf, abs(sd));

    gl_FragColor = vec4(0.0, 0.0, 0.0, strokeAA * edgeAA);
}
`,_=`
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform sampler2D uBlurredMask;   // the 2-pass-blurred stroke mask FBO
uniform vec2  uMaskTexSize;       // size of the mask FBO (= canvas size)
uniform vec4  uHighlightColor;    // rgb + 1.0
uniform float uHighlightAngle;
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;     // 0=Default, 1=Ambient, 2=Plain
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;
// uCornerStyle, uUseContinuousSdf, uContinuousSdf, uContinuousSdfTexSize,
// uContinuousSdfElementSize are declared in SDF_GLSL (do NOT redeclare here).

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);

    // Sample the blurred stroke mask at this pixel. The mask FBO covers the
    // full canvas (same size), so UV = gl_FragCoord / maskTexSize.
    // Mask FBO is Y-down (top-left origin, like our scene FBOs), so flip Y
    // to match the screenCoord convention.
    vec2 maskUv = vec2(gl_FragCoord.x / uMaskTexSize.x, gl_FragCoord.y / uMaskTexSize.y);
    float mask = texture2D(uBlurredMask, maskUv).a;
    if (mask < 0.001) discard;

    // Compute intensity from the SDF gradient (AGSL DefaultHighlightShaderString).
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);
    vec2 origHalfSize = uOriginalSize * 0.5;
    float origRadius = uOriginalCornerRadius;

    // Faithful clip-after-blur: the original does clipOutline \u2192 stroke(blur),
    // but Skia applies clip at the canvas level AFTER the BlurMaskFilter
    // spreads alpha. So alpha that blurred OUTSIDE the shape is clipped away.
    // Our stroke shader clips before blur (discard sd>0), then blur spreads
    // alpha back outside \u2014 we must clip AGAIN here to match. Without this,
    // the highlight "leaks" outside the shape, making it brighter than the
    // original (which has zero contribution outside the clip region).
    float sd = sdShape(centeredOrigRot, origHalfSize, origRadius);
    float clipAA;
    if (uUseContinuousSdf > 0.5) {
        clipAA = sampleClipMask(centeredOrigRot, origHalfSize, origRadius);
    } else {
        clipAA = 1.0 - smoothstep(-0.5, 0.5, sd);
    }
    mask *= clipAA;
    if (mask < 0.001) discard;

    float intensity;
    if (uHighlightMode < 1.5) {
        // Default + Ambient use the SDF gradient \xB7 normal.
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        float d = dot(grad, normal);
        intensity = pow(abs(d), uHighlightFalloff);
    } else {
        // Plain \u2014 no directional intensity (even stroke).
        intensity = 1.0;
    }

    float a = mask * uHighlightAlpha;

    if (uHighlightMode < 0.5) {
        // Default \u2014 Plus blend. Output premultiplied rgb (alpha=1 so blendFunc
        // (ONE, ONE) adds rgb directly).
        vec3 c = uHighlightColor.rgb * intensity * a;
        gl_FragColor = vec4(c, 1.0);
    } else if (uHighlightMode < 1.5) {
        // Ambient \u2014 SrcOver blend. Premultiplied output.
        // Ambient uses t = step(0, d) in the original, but we keep abs(d)
        // (both sides bright) to match the existing behavior. The original's
        // step gives a hard dark/bright split; our abs gives symmetric glow.
        float i = intensity * a;
        gl_FragColor = vec4(uHighlightColor.rgb * i, i);
    } else {
        // Plain \u2014 Plus blend, no intensity.
        vec3 c = uHighlightColor.rgb * a;
        gl_FragColor = vec4(c, 1.0);
    }
}
`,v=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform sampler2D uStrokeMask;
uniform vec2  uMaskOffset;
uniform vec2  uMaskSize;
uniform vec4  uHighlightColor;
uniform float uHighlightAngle;
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform float uHighlightMode;
uniform vec2  uOriginalSize;
uniform float uOriginalCornerRadius;
uniform vec2  uLayerScale;
uniform float uElementRotation;

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);

    // Map screen coord \u2192 element-local ORIGINAL space (un-scale, un-rotate).
    // The stroke mask is drawn in original space (origSizeX \xD7 origSizeY + margin).
    // elementCenter is the same in scaled and original space (scaling is around center).
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    // Mask UV: map original-space coord \u2192 mask texture UV.
    // The mask was drawn with translate(margin, margin), so mask (0,0) =
    // element-local (-margin). Element-local coord 0..origSize maps to
    // mask UV (0+margin)/maskSize .. (origSize+margin)/maskSize.
    // uMaskOffset = margin (scalar, passed as vec2 for convenience).
    // uMaskSize = (origSize + 2*margin).
    vec2 origHalfSize = uOriginalSize * 0.5;
    vec2 maskTexCoord = centeredOrigRot + origHalfSize;  // 0..origSize (element-local)
    vec2 maskUv = (maskTexCoord + uMaskOffset) / uMaskSize;
    if (maskUv.x < 0.0 || maskUv.x > 1.0 || maskUv.y < 0.0 || maskUv.y > 1.0) discard;
    float mask = texture2D(uStrokeMask, maskUv).a;
    if (mask < 0.001) discard;

    float origRadius = uOriginalCornerRadius;

    float intensity;
    if (uHighlightMode < 1.5) {
        float gradRadius = min(origRadius * 1.5, min(origHalfSize.x, origHalfSize.y));
        vec2 grad = gradSdRoundedRect(centeredOrigRot, origHalfSize, gradRadius);
        vec2 normal = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
        float d = dot(grad, normal);
        intensity = pow(abs(d), uHighlightFalloff);
    } else {
        intensity = 1.0;
    }

    float a = mask * uHighlightAlpha;
    if (uHighlightMode < 0.5) {
        gl_FragColor = vec4(uHighlightColor.rgb * intensity * a, 1.0);
    } else if (uHighlightMode < 1.5) {
        float i = intensity * a;
        gl_FragColor = vec4(uHighlightColor.rgb * i, i);
    } else {
        gl_FragColor = vec4(uHighlightColor.rgb * a, 1.0);
    }
}
`,y=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;           // element top-left in canvas px (top-left origin) \u2014 SCALED rect
uniform vec2  uSize;             // element size in canvas px \u2014 SCALED
uniform vec4  uCornerRadii;      // (topLeft, topRight, bottomRight, bottomLeft) \u2014 SCALED
uniform sampler2D uInnerShadowMask; // Canvas2D-generated blurred ring mask
uniform vec2  uMaskOffset;       // margin in device px (for UV mapping: element-local \u2192 mask UV)
uniform vec2  uMaskSize;         // total mask size in device px (w+2*margin, h+2*margin)
uniform vec3  uInnerShadowColor; // shadow color RGB
uniform float uInnerShadowAlpha; // shadow alpha
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer
uniform float uElementRotation;     // rotation in radians (graphicsLayer rotationZ)

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);

    // Map screen coord \u2192 element-local ORIGINAL space (un-scale, un-rotate).
    // The inner shadow mask is drawn in original space (origSize + margin).
    // elementCenter is the same in scaled and original space (scaling is
    // around center).
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 centeredOrigRot = rotateBy(centeredOrig, -uElementRotation);

    // SDF for shape clip \u2014 faithful to InnerShadowModifier.kt's final
    // clipOutline call before drawLayer. The original uses Skia's
    // geometric clip with smooth AA (sub-pixel transition).
    // We replicate with smoothstep \u2014 NO hard discard.
    vec2 origHalfSize = uOriginalSize * 0.5;
    float sd = sdShape(centeredOrigRot, origHalfSize, uOriginalCornerRadius);

    // Smooth clipAlpha: 1.0 fully inside (sd \u2264 0), smoothly fading
    // across the boundary (sd 0\u21921.5), 0.0 outside (sd \u2265 1.5).
    // The 1.5px transition width matches Skia's clipOutline AA behavior
    // \u2014 pixels at the exact boundary (sd=0) retain FULL intensity, with
    // a gentle fade that removes outward blur leakage smoothly.
    // This is NOT a hard discard \u2014 it's a smooth clip that matches the
    // original's geometric clipOutline exactly.
    float clipAlpha = 1.0 - smoothstep(0.0, 1.5, sd);

    // Skip truly invisible pixels for performance (not a visual clip)
    if (clipAlpha < 0.004) discard;

    // Map to mask UV: original-space coord \u2192 mask texture UV.
    vec2 maskTexCoord = centeredOrigRot + origHalfSize;  // 0..origSize (element-local)
    vec2 maskUv = (maskTexCoord + uMaskOffset) / uMaskSize;

    // Sample the mask texture. CLAMP_TO_EDGE wrapping handles UV values
    // slightly outside (0..1) gracefully \u2014 returns transparent at edges.
    float mask = texture2D(uInnerShadowMask, maskUv).a;

    // Skip truly invisible pixels for performance (not a visual clip)
    // Threshold is very low to avoid cutting off faint but visible shadow edges.
    if (mask < 0.003) discard;

    // Premultiplied SrcOver composite: shadowColor \xD7 mask \xD7 shadowAlpha \xD7 clipAlpha.
    // clipAlpha provides smooth shape-boundary transition (faithful to original's
    // clipOutline AA). Output is premultiplied (rgb = color * alpha).
    // Renderer uses gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA) \u2014 premultiplied SrcOver.
    float a = mask * uInnerShadowAlpha * clipAlpha;
    gl_FragColor = vec4(uInnerShadowColor * a, a);
}
`,b=`
attribute vec2 aPos;
void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`,x=`
precision highp float;

uniform sampler2D uBackdrop;
uniform vec2 uCanvasSize;
uniform vec2 uWallpaperSize;

${i}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 uv = coverUv(screenCoord);
    gl_FragColor = texture2D(uBackdrop, uv);
}
`,S=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uCanvasSize;

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uCanvasSize.x, gl_FragCoord.y / uCanvasSize.y);
    gl_FragColor = texture2D(uTexture, uv);
}
`,C=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uCanvasSize;
uniform vec3 uNeutralColor;
uniform vec4 uGlassRect;
uniform vec4 uIndicatorRect;
uniform float uGlassAlpha;
uniform float uIndicatorAlpha;

float capsuleCoverage(vec2 pixel, vec4 rect) {
    if (rect.z <= 0.0 || rect.w <= 0.0) return 0.0;
    vec2 halfSize = rect.zw * 0.5;
    float radius = min(halfSize.x, halfSize.y);
    vec2 q = abs(pixel - (rect.xy + halfSize)) - halfSize + vec2(radius);
    float sd = length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radius;
    return 1.0 - smoothstep(-1.0, 1.0, sd);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uCanvasSize;
    vec3 color = texture2D(uTexture, uv).rgb;
    vec3 difference = abs(color - uNeutralColor);
    float strength = max(difference.r, max(difference.g, difference.b));
    // Preserve the actual animated capsule silhouettes even where their RGB
    // matches the neutral backdrop. Color contrast alone would erase them.
    vec2 pixel = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    float glass = capsuleCoverage(pixel, uGlassRect) * uGlassAlpha;
    float indicator = capsuleCoverage(pixel, uIndicatorRect) * uIndicatorAlpha;
    float opacity = max(max(glass, indicator), clamp(strength * 3.0, 0.0, 1.0));
    gl_FragColor = vec4(color, opacity);
}
`,w=`
precision highp float;

uniform vec4 uColor;

void main() {
    gl_FragColor = uColor;
}
`,T=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uTexSize;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uTexSize.x, gl_FragCoord.y / uTexSize.y);
    vec4 c = texture2D(uTexture, uv);
    float invSat = 1.0 - uSaturation;
    float r = 0.213 * invSat;
    float g = 0.715 * invSat;
    float b = 0.072 * invSat;
    float t = (0.5 - uContrast * 0.5 + uBrightness);
    float cs = uContrast * uSaturation;
    float cr = uContrast * r;
    float cg = uContrast * g;
    float cb = uContrast * b;
    vec3 outc;
    outc.r = (cr + cs) * c.r + cg * c.g + cb * c.b + t;
    outc.g = cr * c.r + (cg + cs) * c.g + cb * c.b + t;
    outc.b = cr * c.r + cg * c.g + (cb + cs) * c.b + t;
    gl_FragColor = vec4(outc, c.a);
}
`,E=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uCanvasSize;
uniform vec3 uTintColor;   // rgb 0..1 (accentColor)

// ColorFilter.tint(color, blendMode = BlendMode.SrcIn):
//   result.rgb = src.rgb (the tint color)
//   result.a   = dst.a * src.a
// SrcIn replaces the destination's RGB with the tint color while
// preserving its alpha — opaque content becomes solid tint, transparent
// areas stay transparent. This matches Compose's ColorFilter.tint default.
void main() {
    vec2 uv = vec2(gl_FragCoord.x / uCanvasSize.x, gl_FragCoord.y / uCanvasSize.y);
    vec4 src = texture2D(uTexture, uv);
    gl_FragColor = vec4(uTintColor, src.a);
}
`,D=`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uCanvasSize;
uniform vec2 uOffset;   // foreground texture top-left in canvas px (top-left origin) \u2014 SCALED rect
uniform vec2 uSize;     // foreground texture size in canvas px \u2014 SCALED
uniform vec4 uCornerRadii;  // capsule radii (topLeft, topRight, bottomRight, bottomLeft) in px \u2014 SCALED
uniform float uAlpha;   // global alpha multiplier (used for press fade)
// --- ORIGINAL-SPACE SDF clip (faithful to graphicsLayer { scaleX, scaleY }) ---
// The original wraps everything (text included) in a graphicsLayer clipped to
// the capsule shape, THEN scales the layer. So the clip shape is the ORIGINAL
// capsule, not the stretched one. We compute the clip SDF in original space so
// a stretched button keeps correct capsule clipping (no corner bleed). The
// texture UV still uses the scaled rect (uOffset/uSize) since the foreground
// texture is rendered at the element's scaled on-screen size.
uniform vec2  uOriginalSize;        // element size in px (ORIGINAL, unscaled)
uniform float uOriginalCornerRadius; // corner radius in px (ORIGINAL, unscaled)
uniform vec2  uLayerScale;          // (scaleX, scaleY) from graphicsLayer

${r}

void main() {
    // gl_FragCoord is bottom-left origin in WebGL framebuffer space.
    // Flip Y to get top-left origin (matching CSS / 2D canvas convention).
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;
    // Scissor to the (scaled) foreground rectangle.
    if (localCoord.x < 0.0 || localCoord.x > uSize.x ||
        localCoord.y < 0.0 || localCoord.y > uSize.y) {
        discard;
    }

    // --- Capsule clip in ORIGINAL space (faithful to graphicsLayer clip) ---
    // elementCenter is the SAME for scaled and original rects (scaling is
    // around the center). Map screen coord \u2192 original space for the SDF so
    // the clip shape is the original capsule, not the stretched one.
    vec2 elementCenter = uOffset + uSize * 0.5;
    vec2 centeredScreen = screenCoord - elementCenter;
    vec2 layerScale = max(uLayerScale, vec2(1e-4));
    vec2 centeredOrig = centeredScreen / layerScale;
    vec2 origHalfSize = uOriginalSize * 0.5;
    float clipAlpha;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredOrig, origHalfSize, uOriginalCornerRadius);
        if (mask < 0.01) discard;
        clipAlpha = mask;
    } else {
        float sdClip = sdClipShape(centeredOrig, origHalfSize, uOriginalCornerRadius);
        if (sdClip > 0.5) discard;
        clipAlpha = 1.0 - smoothstep(-0.5, 0.5, sdClip);
    }

    // The texture is uploaded from a 2D canvas with UNPACK_FLIP_Y_WEBGL=false,
    // so texture row 0 (= v=0) is the TOP row of the source canvas. Combined
    // with the Y flip above, uv.y=0 corresponds to the top of the button rect
    // (which is what we want \u2014 text drawn at the middle of the source canvas
    // appears at the middle of the button).
    //
    // The texture is uploaded with UNPACK_PREMULTIPLY_ALPHA_WEBGL=true, so
    // c is already in premultiplied form (c.rgb <= c.a). We scale both
    // rgb and a by uAlpha * clipAlpha and output premultiplied rgba, paired
    // with blendFunc(ONE, ONE_MINUS_SRC_ALPHA) at the draw site.
    vec2 uv = localCoord / uSize;
    vec4 c = texture2D(uTexture, uv);
    float a = c.a * uAlpha * clipAlpha;
    gl_FragColor = vec4(c.rgb * uAlpha * clipAlpha, a);
}
`,O=`
precision highp float;

uniform vec2  uCanvasSize;
uniform vec2  uOffset;
uniform vec2  uSize;
uniform vec4  uCornerRadii;
uniform vec4  uColor;       // rgba (premultiplied not required; alpha used as-is)

${r}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;
    vec2 halfSize = uSize * 0.5;
    vec2 centeredCoord = localCoord - halfSize;

    float radius = radiusAt(centeredCoord, uCornerRadii);
    float alpha;
    if (uUseContinuousSdf > 0.5) {
        float mask = sampleClipMask(centeredCoord, halfSize, radius);
        if (mask < 0.01) discard;
        alpha = mask;
    } else {
        float sdClip = sdClipShape(centeredCoord, halfSize, radius);
        if (sdClip > 0.5) discard;
        alpha = 1.0 - smoothstep(-0.5, 0.5, sdClip);
    }
    gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
}
`,k=`
precision highp float;

uniform sampler2D uBackdrop;
uniform vec2  uCanvasSize;
uniform vec2  uWallpaperSize;
uniform vec2  uOffset;          // band top-left in canvas px (top-left origin)
uniform vec2  uSize;            // band size in canvas px
uniform float uBlurRadius;      // px in canvas space
uniform vec4  uTintColor;       // rgba
uniform float uTintIntensity;   // 0..1

${i}

// 9-tap poisson disc \u2014 offsets are inlined because GLSL ES 1.00 (WebGL 1)
// does not support array constructors or const-array initializers.
// The offsets are normalized (unit disc), multiplied by step (radius in UV).
vec4 sampleBackdrop(vec2 canvasPx, float radius) {
    vec2 uvScale = canvasPxToUvScale();
    vec2 uv = coverUv(canvasPx);
    vec2 st = radius * uvScale;
    vec4 sum = vec4(0.0);
    sum += texture2D(uBackdrop, uv + vec2( 0.0000,  0.0000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.5000,  0.0000) * st);
    sum += texture2D(uBackdrop, uv + vec2(-0.5000,  0.0000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.0000,  0.5000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.0000, -0.5000) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.3536,  0.3536) * st);
    sum += texture2D(uBackdrop, uv + vec2(-0.3536,  0.3536) * st);
    sum += texture2D(uBackdrop, uv + vec2( 0.3536, -0.3536) * st);
    sum += texture2D(uBackdrop, uv + vec2(-0.3536, -0.3536) * st);
    return sum / 9.0;
}

void main() {
    vec2 screenCoord = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
    vec2 localCoord = screenCoord - uOffset;
    // Outside the band \u2014 nothing to draw.
    if (localCoord.x < 0.0 || localCoord.x > uSize.x ||
        localCoord.y < 0.0 || localCoord.y > uSize.y) {
        discard;
    }

    // Alpha mask: opaque at top (coord.y = size.y, i.e. BOTTOM in top-left
    // origin = size.y in AGSL coord), transparent at bottom. Matches the
    // Kotlin smoothstep(size.y, size.y * 0.5, coord.y).
    float a = smoothstep(uSize.y, uSize.y * 0.5, localCoord.y);

    // Sample the (cover-fit) backdrop at the canvas pixel, blurred.
    vec4 blurred = sampleBackdrop(screenCoord, uBlurRadius);

    // Faithful to AlphaMask shader: mix(content * blurAlpha, tint * tintAlpha, tintIntensity)
    // This is PREMULTIPLIED (rgb already scaled by alpha). The renderer uses
    // premultiplied alpha blending for the progressive blur pass, so we output
    // premultiplied rgb with the mask alpha.
    vec3 premulRgb = mix(blurred.rgb * a, uTintColor.rgb * a, uTintIntensity);
    gl_FragColor = vec4(premulRgb, a);
}
`,A=`
precision highp float;
uniform vec2 iResolution; uniform float iTime;
uniform float uSpeed; uniform float uScale;
const float PI = 3.14159265359;
const float AMPLITUDE   = 0.32;
const float FREQ        = 1.1;
const float ABER_FREQ   = 1.0;
const float SPEED       = 2.4;
const float WAVE_SCALE  = 0.6;
const float ABERRATION  = 2.6;
const float THICKNESS   = 3.0;
const float INTENSITY   = 2.;
const float FALLOFF     = 1.7;
const float EDGE_MASK   = 0.4;
const float EDGE_INSET  = 0.0;
const float BAND_FILL   = 30000.0;
const float BAND_THICK  = 0.08;
const float SOFTNESS    = 2.5;
const float LOW_AMP     = 6.0;
const float LOW_INT     = 1.5;
const float MID_ABER    = 0.8;
const float MID_ABAMP   = 0.05;
const float MID_BAND    = 20.0;
const float MID_SOFT    = 0.4;
const float HIGH_ABER   = 0.5;
const float HIGH_ABAMP  = 0.06;
const float RESOLVED    = 1.0;
const float UNRES_SCALE = 0.14;

vec3 spectral4(int s){
    float x = float(s);
    return clamp(vec3(abs(x-3.0)-1.0, 2.0-abs(x-2.0), 2.0-abs(x-4.0)), 0.0, 1.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 R = iResolution.xy;
    float aspect = R.x / R.y;
    vec2 p = (fragCoord + 0.5) * 2.0 / R - 1.0;
    p.x *= aspect;
    float yScreen = p.y;
    p /= max(WAVE_SCALE * uScale, 0.1);

    float t   = iTime * uSpeed;
    float low  = clamp(0.45 + 0.45*sin(t*0.8)*sin(t*0.37+1.0), 0.0, 1.0);
    float mid  = clamp(0.40 + 0.40*sin(t*1.7+2.0)*sin(t*0.53), 0.0, 1.0);
    float high = clamp(0.30 + 0.30*sin(t*2.9+4.0)*sin(t*0.71+2.0), 0.0, 1.0);

    float res   = clamp(RESOLVED, 0.0, 1.0);
    float drift = mod(t, 20.0*PI) * SPEED;

    float xN  = p.x / max(aspect, 1.0);
    float env = cos(PI*0.5 * min(abs(0.9*xN), 1.0));
    env *= env;

    float A1    = AMPLITUDE + 0.01*low*LOW_AMP;
    float A2    = A1 + mid*MID_ABAMP + high*HIGH_ABAMP;
    float AB    = (ABERRATION + mid*MID_ABER + high*HIGH_ABER)*res;
    float th    = mix(0.1, 0.01*THICKNESS, res);
    float inten = mix(0.1, 0.01*(INTENSITY + low*LOW_INT), res);
    float soft  = 0.01*res*max(0.0, SOFTNESS + mid*MID_SOFT);

    float dUnres = max(length(p) - mix(0.14, UNRES_SCALE, res), 0.0);
    float yMain = A1 * env * res * sin(p.x*FREQ + drift);

    float bandFillTh = max(BAND_THICK, 1e-4);
    float bandAmt    = 1e-4 * BAND_FILL * inten;
    vec3 num = vec3(0.0), den = vec3(0.0);
    for(int s = 0; s < 4; s++){
        vec3 hue = mix(vec3(1.0), spectral4(s), res);
        den += hue;
        float ab = mix(-AB, AB, float(s)/3.0);
        float yL = A2 * env * res * sin(p.x*ABER_FREQ + drift + ab);
        float d   = mix(dUnres, abs(p.y - yL), res);
        float lor = mix(1.0/(1.0 + (0.02*d)*(0.02*d)), 1.0, res);
        float line = inten / (sqrt(d*d + soft*soft) + th);
        float lo = min(yMain, yL), hi = max(yMain, yL);
        float dBand = max(0.0, max(p.y - hi, lo - p.y));
        float band  = bandAmt / (dBand + bandFillTh);
        num += hue * lor * (line + band);
    }
    vec3 col = num / den;

    float dM    = mix(dUnres, abs(p.y - yMain), res);
    float lorM  = mix(1.0/(1.0 + (0.02*dM)*(0.02*dM)), 1.0, res);
    float boost = (1.0 - res) * (14.0*low + 4.0);
    col += 0.5 * inten * (lorM + boost) / (sqrt(dM*dM + soft*soft) + th);

    col = pow(max(col, 0.0), vec3(1.5));
    float emT = clamp((abs(yScreen) - 1.0 + EDGE_INSET) / (-max(EDGE_MASK, 1e-4)), 0.0, 1.0);
    float em  = emT*emT*(3.0 - 2.0*emT);
    float gauss = exp(-pow(xN*FALLOFF, 2.0));
    col *= mix(1.0, em*gauss, res);
    col *= res;
    float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    fragColor = vec4(col * a, a);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }
`,j=`
precision highp float;
uniform vec2 iResolution; uniform float iTime;
uniform float uSpeed; uniform float uScale;
const float TAU = 6.28318530718;
const int   N   = 6;
const float SMOOTH_K = 0.08;
const float INTENSITY  = 0.0025;
const float FALLOFF_P  = 1.35;
const float FADE_START = 0.02;
const float FADE_END   = 0.56;
const float ABERR = 0.005;
const vec3  SPECTRAL = vec3(0.0, 0.5, 1.0) * ABERR;
const float HUE_SPEED = 0.06;
const float COLOR_K   = 0.5;
const float SAT       = 0.01;
const float HUE_SPAN  = 0.667;
const float MERGE_PERIOD = 6.0;
const float T_MOVE   = 1.25;
const float STAGGER  = 0.33;
const float HOLD     = 0.0;
const float W = 4.6;
const float L = 3.2;
const float PIERCE  = 0.12;
const float RECOIL  = 0.035;
const float REC_LAG = 0.11;
const float GATHER_PERIOD = 12.0;
const float GATHER_START  = 9.2;
const float GATHER_HOLD   = 0.8;
const float GATHER_R      = 0.008;
const float GATHER_DIM    = 0.85;
const float GATHER_IN     = 1.8;
const float GATHER_IN_L   = 7.5;
const float BURST_W = 6.5;
const float BURST_L = 4.0;
const float CHARGE_T     = 0.30;
const float CHARGE_SHRK  = 0.18;
const float CHARGE_GLOW  = 0.35;
const float FLASH_GAIN   = 1.2;
const float FLASH_DECAY  = 7.0;

float hash11(float n){ return fract(sin(n*127.1 + 311.7)*43758.5453); }
float settleWL(float tau, float w, float l){
    if(tau <= 0.0) return 0.0;
    return 1.0 - exp(-l*tau)*cos(w*tau);
}
float settle(float tau){ return settleWL(tau, W, L); }
float settleCrit(float tau, float l){
    if(tau <= 0.0) return 0.0;
    return 1.0 - exp(-l*tau)*(1.0 + l*tau);
}
float smin(float a, float b, float k){
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h*h*k*0.25;
}
vec3 hue2rgb(float h){
    h = fract(h);
    float r = clamp(abs(h*6.0 - 3.0) - 1.0, 0.0, 1.0);
    float g = clamp(2.0 - abs(h*6.0 - 2.0), 0.0, 1.0);
    float b = clamp(2.0 - abs(h*6.0 - 4.0), 0.0, 1.0);
    return vec3(r, g, b);
}
float dotR(float fi, float seed, float t){
    return 0.036 + 0.010*sin(t*1.3 + seed*TAU) + 0.005*sin(t*2.4 + fi*1.3);
}
float dotSD(vec2 p, vec2 pos, float r, float t, float fi, float shapeDamp){
    vec2 d = p - pos;
    float sq = 0.075 * (0.5 + 0.5*sin(t*0.9 + fi*2.0)) * shapeDamp;
    float ca = cos(t*0.35 + fi), sa = sin(t*0.35 + fi);
    d = mat2(ca,-sa,sa,ca) * d;
    d *= vec2(1.0+sq, 1.0-sq);
    return length(d) - r;
}
vec3 scene(vec2 p, float t){
    float k  = floor(t/MERGE_PERIOD);
    float u  = fract(t/MERGE_PERIOD);
    float te = u * MERGE_PERIOD;
    float tg = mod(t, GATHER_PERIOD);
    float g  = settleCrit((tg - GATHER_START) * GATHER_IN, GATHER_IN_L)
             - settleWL(tg - GATHER_START - GATHER_HOLD, BURST_W, BURST_L);
    float gC = clamp(g, 0.0, 1.0);
    float tb     = tg - (GATHER_START + GATHER_HOLD);
    float charge = smoothstep(-CHARGE_T, 0.0, min(tb, 0.0)) * gC;
    float flash  = tb > 0.0 ? exp(-tb * FLASH_DECAY) : 0.0;
    float gBright = mix(1.0, GATHER_DIM, gC) * (1.0 + CHARGE_GLOW*charge + FLASH_GAIN*flash);
    vec3  total3 = vec3(1e5);
    vec3  cAcc   = vec3(0.0);
    float wAcc   = 1e-6;
    for(int i=0; i<N; i++){
        float fi   = float(i);
        float seed = hash11(fi);
        float ang = fi/float(N)*TAU + t*0.35;
        vec2 dir  = vec2(cos(ang), sin(ang));
        float R = 0.17 + 0.010*sin(t*1.0) + 0.007*sin(t*1.3 + seed*TAU);
        float pairId   = mod(fi, 3.0);
        float moverLow = mod(k + pairId, 2.0);
        float isMover  = (fi < 2.5) ? step(moverLow, 0.5) : step(0.5, moverLow);
        float goStart  = pairId * STAGGER;
        float retStart = 3.0*STAGGER + HOLD + pairId * STAGGER;
        float m   = (settle(te - goStart)           - settle(te - retStart))           * isMover;
        float rec = (settle(te - goStart - REC_LAG) - settle(te - retStart - REC_LAG)) * (1.0 - isMover);
        float rSelf = dotR(fi, seed, t);
        rSelf = mix(rSelf, 0.036, gC);
        rSelf *= 1.0 - CHARGE_SHRK * charge;
        float fj    = mod(fi + 3.0, 6.0);
        float rPart = dotR(fj, hash11(fj), t);
        float deep   = -(R + RECOIL) - PIERCE * rPart;
        float radial = mix(R, deep, m) + RECOIL * rec;
        radial = mix(radial, GATHER_R, g);
        vec2  pos    = radial * dir;
        float sdR = dotSD(p - SPECTRAL.r*dir, pos, rSelf, t, fi, 1.0 - gC);
        float sdG = dotSD(p - SPECTRAL.g*dir, pos, rSelf, t, fi, 1.0 - gC);
        float sdB = dotSD(p - SPECTRAL.b*dir, pos, rSelf, t, fi, 1.0 - gC);
        total3 = vec3( smin(total3.r, sdR, SMOOTH_K),
                       smin(total3.g, sdG, SMOOTH_K),
                       smin(total3.b, sdB, SMOOTH_K) );
        float hue = fract(fi/float(N) + t*HUE_SPEED) * HUE_SPAN;
        vec3 dotCol = mix(vec3(1.0), hue2rgb(hue), SAT);
        float w = exp(-sdG * COLOR_K);
        cAcc += w * dotCol;
        wAcc += w;
    }
    vec3 sd3    = max(total3, vec3(0.0)) + 1e-4;
    vec3 core3  = clamp(INTENSITY / pow(sd3, vec3(FALLOFF_P)), 0.0, 1.0);
    vec3 edge3  = 1.0 - smoothstep(vec3(FADE_START), vec3(FADE_END), sd3);
    vec3 bright = core3 * edge3 * gBright;
    return bright * (cAcc / wAcc);
}
void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 res = iResolution.xy;
    vec2 p = (2.0*fragCoord - res) / min(res.x, res.y);
    float t = iTime * uSpeed;
    p /= 1.0 + 0.03*sin(t*1.0);
    p /= uScale;
    vec3 col = scene(p, t);
    col *= 1.0 + 0.05*sin(t*1.0 + 1.0);
    col = pow(col, vec3(1.0/1.2));
    col = min(col, 1.0);
    float n = fract(sin(dot(fragCoord, vec2(12.9898,78.233)))*43758.5453);
    col += (n - 0.5)/255.0;
    float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    fragColor = vec4(col * a, a);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }
`;function M(e){if(e<=1)return[{offset:0,weight:1}];let t=[],n=Math.floor(e/2),r=0;for(let i=0;i<e;i++){let a=(e%2==1?i-n:i-n+.5)/n*3,o=Math.exp(-.5*a*a);t.push({offset:a,weight:o}),r+=o}if(r>0)for(let e of t)e.weight/=r;return t}function N(e,t){let n=M(e),r=t===`horizontal`?`vec2(1.0, 0.0)`:`vec2(0.0, 1.0)`,i=``;if(n.length===1)i=`    gl_FragColor = texture2D(uTexture, uv);
`;else{i=`    vec3 rgbSum = vec3(0.0);
    float rgbW = 0.0;
`;for(let e of n){let t=e.offset.toFixed(6),n=e.weight.toFixed(8);i+=`    { vec4 s = texture2D(uTexture, uv + ${r} * ${t} * pxToUv); float aw = s.a * ${n}; rgbSum += s.rgb * aw; rgbW += aw; }
`}i+=`    float origA = texture2D(uTexture, uv).a;
    gl_FragColor = vec4(rgbW > 0.001 ? rgbSum / rgbW : vec3(0.0), origA);
`}return`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uTexSize;
uniform float uRadius;

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uTexSize.x, gl_FragCoord.y / uTexSize.y);
    if (uRadius < 0.5) {
        gl_FragColor = texture2D(uTexture, uv);
        return;
    }
    vec2 pxToUv = vec2(uRadius / uTexSize.x, uRadius / uTexSize.y);
${i}}
`}function P(e){if(e<.5)return 1;let t=e*.57735+.5,n=2*Math.ceil(3*t)+1;return Math.min(33,Math.max(1,n))}function F(e){if(e<=1)return[{offset:0,weight:1}];let t=[],n=Math.floor(e/2),r=0;for(let i=0;i<e;i++){let e=i-n,a=Math.exp(-.5*e*e);t.push({offset:e,weight:a}),r+=a}if(r>0)for(let e of t)e.weight/=r;return t}function I(e,t){let n=F(e),r=t===`horizontal`?`vec2(1.0, 0.0)`:`vec2(0.0, 1.0)`,i=``;if(n.length===1)i=`    gl_FragColor = texture2D(uTexture, uv);
`;else{i=`    float aSum = 0.0;
`;for(let e of n){let t=e.offset.toFixed(6),n=e.weight.toFixed(8);i+=`    aSum += texture2D(uTexture, uv + ${r} * ${t} * pxToUv).a * ${n};
`}i+=`    gl_FragColor = vec4(0.0, 0.0, 0.0, aSum);
`}return`
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uTexSize;
uniform float uRadius;  // Gaussian sigma in pixels (Android BlurMaskFilter semantics)

void main() {
    vec2 uv = vec2(gl_FragCoord.x / uTexSize.x, gl_FragCoord.y / uTexSize.y);
    if (uRadius < 0.01) {
        gl_FragColor = texture2D(uTexture, uv);
        return;
    }
    // pxToUv converts a pixel offset to a UV offset. offset (in \u03C3 units) *
    // sigma_px = pixel offset; / uTexSize = UV offset.
    vec2 pxToUv = vec2(uRadius / uTexSize.x, uRadius / uTexSize.y);
${i}}
`}function ee(e){if(e<.01)return 1;let t=2*Math.ceil(3*e)+1;return Math.min(33,Math.max(3,t))}function L(e,t,n=!1){let r=Math.max(1,t.width),i=Math.max(1,t.height),a=t.getContext(`2d`,{willReadFrequently:!0});if(!a){e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t);return}let o=a.getImageData(0,0,r,i).data;if(n)for(let e=0;e<o.length;e+=4){let t=o[e+3]/255;o[e]=o[e]*t|0,o[e+1]=o[e+1]*t|0,o[e+2]=o[e+2]*t|0}e.texImage2D(e.TEXTURE_2D,0,e.RGBA,r,i,0,e.RGBA,e.UNSIGNED_BYTE,o)}function R(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`Shader compile error: `+t)}return r}function z(e,t,n){let r=R(e,e.VERTEX_SHADER,t),i=R(e,e.FRAGMENT_SHADER,n),a=e.createProgram();if(e.attachShader(a,r),e.attachShader(a,i),e.linkProgram(a),!e.getProgramParameter(a,e.LINK_STATUS)){let t=e.getProgramInfoLog(a);throw e.deleteProgram(a),Error(`Program link error: `+t)}return a}function te(e,t,n){let r=t.split(/\s+/),i=[],a=``;for(let t of r){let r=a?a+` `+t:t;e.measureText(r).width<=n||!a?a=r:(i.push(a),a=t)}return a&&i.push(a),i}function ne(e){if(e<=0)return 0;if(e>=1)return 1;let t=.42,n=e;for(let r=0;r<8;r++){let r=3*(1-n)*(1-n)*n*t+3*(1-n)*n*n*1+n*n*n,i=3*(1-n)*(1-n)*t+6*(1-n)*n*.5800000000000001+3*n*n*0;if(Math.abs(r-e)<.001||Math.abs(i)<1e-6)break;n-=(r-e)/i,n=Math.max(0,Math.min(1,n))}return 3*(1-n)*(1-n)*n*0+3*(1-n)*n*n*1+n*n*n}var re=32;function ie(e,t){return[`is`,e,t.useG2?`g2`:`rr`,t.w.toFixed(3),t.h.toFixed(3),t.radius.toFixed(3),t.offsetX.toFixed(3),t.offsetY.toFixed(3),t.blurSigma.toFixed(3),t.margin,Math.ceil(t.w+2*t.margin),Math.ceil(t.h+2*t.margin),`ss${t.supersample}`].join(`:`)}function ae(e,t,n,r,i){let a=e.get(n);if(a)return a;let o=t.createTexture();if(!o)throw Error(`WebGL texture allocation failed`);if(a={tex:o,w:r,h:i,ready:!1},e.set(n,a),e.size>re){let r=e.keys().next().value;if(r&&r!==n){let n=e.get(r);n&&t.deleteTexture(n.tex),e.delete(r)}}return a}function oe(e,t,n){e.bindTexture(e.TEXTURE_2D,t.tex),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),L(e,n.canvas),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),t.ready=!0}function se(e,t){for(let n of t.values())e.deleteTexture(n.tex);t.clear()}var ce={gooseFBO(e,t){let n=this.gl,r=n.createTexture();n.bindTexture(n.TEXTURE_2D,r),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,e,t,0,n.RGBA,n.UNSIGNED_BYTE,null),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE);let i=n.createFramebuffer();return n.bindFramebuffer(n.FRAMEBUFFER,i),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,r,0),n.bindFramebuffer(n.FRAMEBUFFER,null),{fb:i,tex:r}},gooseResizeFBO(e,t){if(this.fboW===e&&this.fboH===t&&this.fboA&&this.fboB)return;let n=this.gl;this.fboA&&n.deleteFramebuffer(this.fboA),this.fboATex&&n.deleteTexture(this.fboATex),this.fboB&&n.deleteFramebuffer(this.fboB),this.fboBTex&&n.deleteTexture(this.fboBTex);let r=this.gooseFBO(e,t),i=this.gooseFBO(e,t);this.fboA=r.fb,this.fboATex=r.tex,this.fboB=i.fb,this.fboBTex=i.tex,this.tabsBackdropFbo&&n.deleteFramebuffer(this.tabsBackdropFbo),this.tabsBackdropTex&&n.deleteTexture(this.tabsBackdropTex);let a=this.gooseFBO(e,t);this.tabsBackdropFbo=a.fb,this.tabsBackdropTex=a.tex,this.tabsBackdropDirty=!0,this.gpElementFbo&&n.deleteFramebuffer(this.gpElementFbo),this.gpElementTex&&n.deleteTexture(this.gpElementTex),this.blurFboA&&n.deleteFramebuffer(this.blurFboA),this.blurFboATex&&n.deleteTexture(this.blurFboATex),this.blurFboB&&n.deleteFramebuffer(this.blurFboB),this.blurFboBTex&&n.deleteTexture(this.blurFboBTex);let o=this.gooseFBO(e,t),s=this.gooseFBO(e,t),c=this.gooseFBO(e,t);this.gpElementFbo=o.fb,this.gpElementTex=o.tex,this.blurFboA=s.fb,this.blurFboATex=s.tex,this.blurFboB=c.fb,this.blurFboBTex=c.tex,this.highlightMaskFbo&&n.deleteFramebuffer(this.highlightMaskFbo),this.highlightMaskTex&&n.deleteTexture(this.highlightMaskTex);let l=this.gooseFBO(e,t);this.highlightMaskFbo=l.fb,this.highlightMaskTex=l.tex,this.dialogBackdropFbo&&n.deleteFramebuffer(this.dialogBackdropFbo),this.dialogBackdropTex&&n.deleteTexture(this.dialogBackdropTex);let u=this.gooseFBO(e,t);this.dialogBackdropFbo=u.fb,this.dialogBackdropTex=u.tex,this.dialogBackdropKey=null,this.fboW=e,this.fboH=t},gooseBindFBO(e){let t=this.gl;t.bindFramebuffer(t.FRAMEBUFFER,e),t.viewport(0,0,this.fboW,this.fboH)},gooseCopy(e){let t=this.gl;t.useProgram(this.copyProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocCp),t.vertexAttribPointer(this.aPosLocCp,2,t.FLOAT,!1,0,0),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,e),t.uniform1i(this.uCp.uTexture,0),t.uniform2f(this.uCp.uCanvasSize,this.fboW,this.fboH),t.disable(t.BLEND),t.drawArrays(t.TRIANGLES,0,6)},gooseCopyToCanvas(e){if(!this.transparentBackdrop){this.gooseCopy(e);return}let t=this.gl;t.useProgram(this.transparentBackdropProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocTb),t.vertexAttribPointer(this.aPosLocTb,2,t.FLOAT,!1,0,0),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,e),t.uniform1i(this.uTb.uTexture,0),t.uniform2f(this.uTb.uCanvasSize,this.fboW,this.fboH),t.uniform3fv(this.uTb.uNeutralColor,this.transparentNeutralColor);let n=this.transparentGlassRect||[0,0,0,0],r=this.transparentIndicatorRect||[0,0,0,0];t.uniform4fv(this.uTb.uGlassRect,n),t.uniform4fv(this.uTb.uIndicatorRect,r),t.uniform1f(this.uTb.uGlassAlpha,this.transparentGlassAlpha||0),t.uniform1f(this.uTb.uIndicatorAlpha,this.transparentIndicatorAlpha||0),t.disable(t.BLEND),t.drawArrays(t.TRIANGLES,0,6),this.transparentFrameReady=!0},gooseFill(e,t,n,r){let i=this.gl;i.useProgram(this.solidFillProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocSf),i.vertexAttribPointer(this.aPosLocSf,2,i.FLOAT,!1,0,0),i.uniform4f(this.uSf.uColor,e,t,n,r),i.disable(i.BLEND),i.drawArrays(i.TRIANGLES,0,6)},gooseColorCtrl(e,t,n,r){let i=this.gl;i.useProgram(this.colorControlsProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocCc),i.vertexAttribPointer(this.aPosLocCc,2,i.FLOAT,!1,0,0),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,e),i.uniform1i(this.uCc.uTexture,0),i.uniform2f(this.uCc.uTexSize,this.fboW,this.fboH),i.uniform1f(this.uCc.uBrightness,t),i.uniform1f(this.uCc.uContrast,n),i.uniform1f(this.uCc.uSaturation,r),i.disable(i.BLEND),i.drawArrays(i.TRIANGLES,0,6)}},B=1.4142135623730951,le=.7853981633974483,V=.7071067811865476;function ue(e,t,n,r){let i=(3*n/e-t*t/(e*e))/3,a=(2*t*t*t/(e*e*e)-9*t*n/(e*e)+27*r/e)/27,o=a*a/4+i*i*i/27,s=Math.sqrt(o);return Math.cbrt(-a/2+s)+Math.cbrt(-a/2-s)-t/(3*e)}function de(e,t,n){let r=-e/2,i=-n,a=n*e/2-t*t/8,o=(3*i-r*r)/3,s=(2*r*r*r-9*r*i+27*a)/27,c=Math.sqrt(-o*o*o/27),l=Math.acos(-s/(2*c)),u=2*Math.sqrt(-o/3)*Math.cos(l/3)-r/3,d=Math.sqrt(2*u-e);return(d-Math.sqrt(d*d-4*(u+t/(2*d))))/2}var fe=class{constructor(e=2/3,t=.5){n(this,`extendedFraction`),n(this,`arcFraction`),n(this,`theta`),n(this,`cos`),n(this,`sin`),n(this,`cot`),n(this,`cos2`),n(this,`sin2`),n(this,`cos3`),n(this,`sin3`),n(this,`k0`),n(this,`k1`),n(this,`k2`),n(this,`k3`),this.extendedFraction=e,this.arcFraction=t,this.theta=(1-t)*le,this.cos=Math.cos(this.theta),this.sin=Math.sin(this.theta),this.cot=1/Math.tan(this.theta),this.cos2=this.cos*this.cos,this.sin2=this.sin*this.sin,this.cos3=this.cos2*this.cos,this.sin3=this.sin2*this.sin;let r=this.cos,i=this.sin,a=this.cot,o=this.cos2,s=this.sin2,c=this.cos3,l=this.sin3;this.k0=27*(B-6*r+6*B*o-4*c)*a+2*i*(-9+2*(B-2*i)*l+2*B*r*(9+s)-2*o*(9+2*s)),this.k1=-81*(-2+B+4*(-1+B)*r+2*(-2+B)*o)*a-4*i*(-9+9*B+B*l+(-2+B)*r*(9+s)),this.k2=9*(9*(-4+3*B+(-6+4*B)*r)*a+(-6+4*B)*i),this.k3=27*(10-7*B)*a}buildEvenCornerBezierPoints(e){let t=this.extendedFraction*e,n=ue(this.k3,this.k2,this.k1+8*-t*this.sin3*this.sin,this.k0),r=V+(-V+this.sin)/n,i=1-V+(V-this.cos)/n,a=r-i*this.cot,o=a-1.5*n*i*i/this.sin3,s=-t,c=1-i,l=1-r,u=1-a,d=1-o,f=1-s,p=1.5*n,m=this.cos2-this.sin2,h=c-r,g=l-i,_=-(this.cos*g-this.sin*h),v=(-m+Math.sqrt(m*m-4*p*_))/(2*p);return[s,0,o,0,a,0,r,i,r+v*this.cos,i+v*this.sin,c-v*this.sin,l-v*this.cos,c,l,1,u,1,d,1,f]}buildUnevenCornerBezierPoints(e,t){let n=this.extendedFraction*e,r=this.extendedFraction*t,i=ue(this.k3,this.k2,this.k1+8*-n*this.sin3*this.sin,this.k0),a=ue(this.k3,this.k2,this.k1+8*-r*this.sin3*this.sin,this.k0),o=V+(-V+this.sin)/i,s=1-V+(V-this.cos)/i,c=o-s*this.cot,l=c-1.5*i*s*s/this.sin3,u=-n,d=V+(-V+this.sin)/a,f=1-V+(V-this.cos)/a,p=d-f*this.cot,m=p-1.5*a*f*f/this.sin3,h=-r,g=1-f,_=1-d,v=1-p,y=1-m,b=1-h,x=1.5*i,S=1.5*a,C=this.cos2-this.sin2,w=g-o,T=_-s,E=-(this.cos*T-this.sin*w),D=this.sin*T-this.cos*w,O=de(D/S*2,C*C*C/(x*S*S),(x*D*D+E*C*C)/(x*S*S)),k=(-D-S*O*O)/C;return[u,0,l,0,c,0,o,s,o+k*this.cos,s+k*this.sin,g-O*this.sin,_-O*this.cos,g,_,1,v,1,y,1,b]}getCornerBezierPoints(e,t){let n=e===0?0:e===1?1:-1,r=t===0?0:t===1?1:-1;return n>=0&&r>=0?n===0&&r===0?this.buildEvenCornerBezierPoints(0):n===1&&r===1?this.buildEvenCornerBezierPoints(1):this.buildUnevenCornerBezierPoints(+(n===1),+(r===1)):this.buildUnevenCornerBezierPoints(Math.max(0,Math.min(1,e)),Math.max(0,Math.min(1,t)))}};function pe(e,t,n,r){let i=new fe,a=r,o=Math.max(0,Math.min(1,(t*.5-a)/a)),s=Math.max(0,Math.min(1,(n*.5-a)/a)),c=i.getCornerBezierPoints(o,s);if(c.length<20)return new Path2D;let l=new Path2D,u=t-a,d=0;return l.moveTo(u+c[0]*a,d+c[1]*a),l.bezierCurveTo(u+c[2]*a,d+c[3]*a,u+c[4]*a,d+c[5]*a,u+c[6]*a,d+c[7]*a),l.bezierCurveTo(u+c[8]*a,d+c[9]*a,u+c[10]*a,d+c[11]*a,u+c[12]*a,d+c[13]*a),l.bezierCurveTo(u+c[14]*a,d+c[15]*a,u+c[16]*a,d+c[17]*a,u+c[18]*a,d+c[19]*a),u=t-a,d=n,l.lineTo(u+c[18]*a,d-c[19]*a),l.bezierCurveTo(u+c[16]*a,d-c[17]*a,u+c[14]*a,d-c[15]*a,u+c[12]*a,d-c[13]*a),l.bezierCurveTo(u+c[10]*a,d-c[11]*a,u+c[8]*a,d-c[9]*a,u+c[6]*a,d-c[7]*a),l.bezierCurveTo(u+c[4]*a,d-c[5]*a,u+c[2]*a,d-c[3]*a,u+c[0]*a,d-c[1]*a),u=a,d=n,l.lineTo(u-c[0]*a,d-c[1]*a),l.bezierCurveTo(u-c[2]*a,d-c[3]*a,u-c[4]*a,d-c[5]*a,u-c[6]*a,d-c[7]*a),l.bezierCurveTo(u-c[8]*a,d-c[9]*a,u-c[10]*a,d-c[11]*a,u-c[12]*a,d-c[13]*a),l.bezierCurveTo(u-c[14]*a,d-c[15]*a,u-c[16]*a,d-c[17]*a,u-c[18]*a,d-c[19]*a),u=a,d=0,l.lineTo(u-c[18]*a,d+c[19]*a),l.bezierCurveTo(u-c[16]*a,d+c[17]*a,u-c[14]*a,d+c[15]*a,u-c[12]*a,d+c[13]*a),l.bezierCurveTo(u-c[10]*a,d+c[11]*a,u-c[8]*a,d+c[9]*a,u-c[6]*a,d+c[7]*a),l.bezierCurveTo(u-c[4]*a,d+c[5]*a,u-c[2]*a,d+c[3]*a,u-c[0]*a,d+c[1]*a),l.closePath(),l}var me=new Map;function he(e,t,n,r=1){let i=Math.min(1024,Math.max(256,Math.round(Math.max(e,t)*r*2))),a=`${e},${t},${n},${i}`,o=me.get(a);if(o)return{tex:o.tex,texSize:i};let s=Math.max(e,t),c=e/s,l=t/s,u=document.createElement(`canvas`);u.width=i,u.height=i;let d=u.getContext(`2d`);d.clearRect(0,0,i,i);let f=(i-8)*c,p=(i-8)*l,m=(i-f)/2,h=(i-p)/2,g=f/e*n,_=pe(d,f,p,g);d.fillStyle=`white`,d.translate(m,h),d.fill(_),d.translate(-m,-h);let v=d.getImageData(0,0,i,i),y=new Uint8Array(i*i);for(let e=0;e<i*i;e++)y[e]=v.data[e*4+3];let b=new Float32Array(i*i),x=new Float32Array(i*i),S=1e10;for(let e=0;e<i*i;e++)y[e]>128?(b[e]=0,x[e]=S):(b[e]=S,x[e]=0);for(let e=0;e<i;e++)for(let t=0;t<i;t++){let n=e*i+t;t>0&&e>1&&(b[n]=Math.min(b[n],b[n-i-1-i]+11),x[n]=Math.min(x[n],x[n-i-1-i]+11)),t>0&&(b[n]=Math.min(b[n],b[n-1]+5),x[n]=Math.min(x[n],x[n-1]+5)),t>0&&e>0&&(b[n]=Math.min(b[n],b[n-i-1]+7),x[n]=Math.min(x[n],x[n-i-1]+7)),e>0&&(b[n]=Math.min(b[n],b[n-i]+5),x[n]=Math.min(x[n],x[n-i]+5)),t<i-1&&e>0&&(b[n]=Math.min(b[n],b[n-i+1]+7),x[n]=Math.min(x[n],x[n-i+1]+7)),t<i-2&&e>0&&(b[n]=Math.min(b[n],b[n-i+2]+11),x[n]=Math.min(x[n],x[n-i+2]+11))}for(let e=i-1;e>=0;e--)for(let t=i-1;t>=0;t--){let n=e*i+t;t<i-1&&e<i-2&&(b[n]=Math.min(b[n],b[n+i+1+i]+11),x[n]=Math.min(x[n],x[n+i+1+i]+11)),t<i-1&&(b[n]=Math.min(b[n],b[n+1]+5),x[n]=Math.min(x[n],x[n+1]+5)),t<i-1&&e<i-1&&(b[n]=Math.min(b[n],b[n+i+1]+7),x[n]=Math.min(x[n],x[n+i+1]+7)),e<i-1&&(b[n]=Math.min(b[n],b[n+i]+5),x[n]=Math.min(x[n],x[n+i]+5)),t>0&&e<i-1&&(b[n]=Math.min(b[n],b[n+i-1]+7),x[n]=Math.min(x[n],x[n+i-1]+7)),t>1&&e<i-1&&(b[n]=Math.min(b[n],b[n+i-2]+11),x[n]=Math.min(x[n],x[n+i-2]+11))}let C=g,w=new Uint8Array(i*i*4);for(let e=0;e<i*i;e++){w[e*4]=y[e];let t=(b[e]-x[e])/5,n=Math.max(-1,Math.min(1,t/C));w[e*4+1]=Math.round((n*.5+.5)*255),w[e*4+2]=0,w[e*4+3]=255}return me.set(a,{tex:w,texSize:i}),{tex:w,texSize:i}}var ge={gooseUseTransparentBackdrop(e){let t=this.gl,n=e?18:250,r=n/255;this.transparentNeutralColor=new Float32Array([r,r,r]),this.wallpaperTexture&&t.deleteTexture(this.wallpaperTexture);let i=t.createTexture();if(!i)throw Error(`WebGL texture allocation failed`);t.bindTexture(t.TEXTURE_2D,i),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,1,1,0,t.RGBA,t.UNSIGNED_BYTE,new Uint8Array([n,n,n,255])),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),this.wallpaperTexture=i,this.wallpaperSize=[1,1],this.wallpaperReady=!0,this.gooseBG([r,r,r])},async gooseLoadWP(e){let t=new Image;t.crossOrigin=`anonymous`,await new Promise((n,r)=>{t.onload=()=>n(),t.onerror=()=>r(Error(`Failed to load wallpaper: `+e)),t.src=e});let n=this.gl;this.wallpaperTexture&&n.deleteTexture(this.wallpaperTexture);let r=n.createTexture();n.bindTexture(n.TEXTURE_2D,r),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,n.RGBA,n.UNSIGNED_BYTE,t);let i=t.naturalWidth,a=t.naturalHeight;!(i&i-1)&&!(a&a-1)?(n.generateMipmap(n.TEXTURE_2D),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR_MIPMAP_LINEAR)):n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),this.wallpaperTexture=r,this.wallpaperSize=[i||1,a||1],this.wallpaperReady=!0,this.gooseReqRender()},async gooseLoadSDF(e){let t=new Image;t.crossOrigin=`anonymous`,await new Promise((n,r)=>{t.onload=()=>n(),t.onerror=()=>r(Error(`Failed to load SDF texture: `+e)),t.src=e});let n=this.gl;this.sdfTexture&&n.deleteTexture(this.sdfTexture);let r=n.createTexture();n.bindTexture(n.TEXTURE_2D,r),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.texImage2D(n.TEXTURE_2D,0,n.RGBA,n.RGBA,n.UNSIGNED_BYTE,t),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MAG_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE),this.sdfTexture=r,this.sdfTextureSize=[t.naturalWidth||1,t.naturalHeight||1],this.sdfTextureReady=!0,this.gooseReqRender()},gooseLoadCSDF(e,t,n){let r=`${e},${t},${n},${this.dpr}`,i=this.continuousSdfPool.get(r);if(!i){let{tex:a,texSize:o}=he(e,t,n,this.dpr),s=this.gl,c=s.createTexture();if(s.bindTexture(s.TEXTURE_2D,c),s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!0),s.texImage2D(s.TEXTURE_2D,0,s.RGBA,o,o,0,s.RGBA,s.UNSIGNED_BYTE,a),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MAG_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE),i={tex:c,texSize:o},this.continuousSdfPool.set(r,i),this.continuousSdfPool.size>16){let e=this.continuousSdfPool.keys().next().value;if(e){let t=this.continuousSdfPool.get(e);t&&s.deleteTexture(t.tex),this.continuousSdfPool.delete(e)}}}this.continuousSdfTexture=i.tex,this.continuousSdfTexSize=[i.texSize,i.texSize],this.continuousSdfKey=r},gooseResize(e,t){this.dpr<=0&&(this.dpr=Math.min(window.devicePixelRatio||1,1.5));let n=Math.round(e*this.dpr),r=Math.round(t*this.dpr);(this.canvas.width!==n||this.canvas.height!==r)&&(this.canvas.width=n,this.canvas.height=r,this.gl.viewport(0,0,n,r),this.gooseResizeFBO(n,r));for(let e of this.buttonConfigs)this.fgDirtyIds.add(e.id);this.cssWidth=e,this.cssHeight=t,this.gooseReqRender()}},_e={gooseContentH(e){this.contentHeight=e,this.gooseClampY(),this.gooseReqRender()},gooseScrollY(e){this.scrollVelocity=0,this.scrollY=this.gooseClampScroll(e),this.gooseReqRender()},gooseScrollV(e){this.scrollVelocity=Math.max(-4e3,Math.min(4e3,e)),this.gooseAnimStart()},gooseGetScrollY(){return this.scrollY},gooseGetScrollV(){return this.scrollVelocity},gooseClampScroll(e){let t=Math.max(0,this.contentHeight-this.cssHeight);return e<0?0:e>t?t:e},gooseClampY(){this.scrollY=this.gooseClampScroll(this.scrollY)},gooseBG(e){this.backgroundColor=e,this.gooseReqRender()},gooseGravAngle(e){this.gravityAngle!==e&&(this.gravityAngle=e,this.gooseReqRender())}},ve=20,ye=class{constructor(){n(this,`samples`,[])}resetTracking(){this.samples.length=0}addPosition(e,t){this.samples.push({t:e,p:t}),this.samples.length>ve&&this.samples.shift()}calculateVelocity(e=100){let t=this.samples;if(t.length<2)return 0;let n=t[t.length-1].t,r=n-e,i=0,a=0,o=0,s=0,c=0;for(let e=t.length-1;e>=0;e--){let l=t[e];if(l.t<r)break;let u=(l.t-n)/1e3;a+=u,o+=l.p,s+=u*u,c+=u*l.p,i++}if(i<2)return 0;let l=i*s-a*a;return Math.abs(l)<1e-9?0:(i*c-a*o)/l}},be={gooseEnsureTgl(e,t,n=1.5,r=1){let i=this.toggleStates.get(e);return i?(n!==1.5&&(i.pressedScale=n),r!==1&&(i.valueRangeSpan=r)):(i={fraction:t,fractionVelocity:0,targetFraction:t,pressProgress:0,pressVelocity:0,targetPress:0,scaleX:1,scaleXVelocity:0,targetScaleX:1,scaleY:1,scaleYVelocity:0,targetScaleY:1,velocity:0,velocityVelocity:0,targetVelocity:0,isDragging:!1,trackVelocityAfterRelease:!1,velocityTracker:new ye,lastFractionForVelocity:t,lastFractionTime:0,pressedScale:n,valueRangeSpan:r,panelOffset:0,panelOffsetVelocity:0,targetPanelOffset:0},this.toggleStates.set(e,i)),i},gooseTglTarget(e,t){let n=this.gooseEnsureTgl(e,t);n.isDragging||n.targetFraction!==t&&(n.targetFraction=t,n.trackVelocityAfterRelease=!1,n.targetVelocity=0,n.velocity=0,n.velocityVelocity=0,n.velocityTracker.resetTracking(),n.targetPress===0&&(n.targetPress=1,n.targetScaleX=n.pressedScale,n.targetScaleY=n.pressedScale),this.gooseAnimStart())},gooseTglDragStart(e,t){let n=this.gooseEnsureTgl(e,t);n.isDragging=!0,n.targetPress=1,n.targetScaleX=n.pressedScale,n.targetScaleY=n.pressedScale,n.velocityTracker.resetTracking(),n.targetVelocity=0,n.velocity=0,n.velocityVelocity=0,this.gooseAnimStart()},gooseTglDrag(e,t,n,r,i){let a=this.gooseEnsureTgl(e,t);if(!a.isDragging)return;let o=(n-r)/Math.max(1,i);a.targetFraction=Math.max(0,Math.min(1,t+o)),this.gooseAnimStart()},gooseTglDragEnd(e){let t=this.toggleStates.get(e);if(!t)return 0;t.isDragging=!1;let n=+(t.targetFraction>=.5);return t.targetFraction=n,t.trackVelocityAfterRelease=!0,this.gooseAnimStart(),n},gooseSldDragEnd(e){let t=this.toggleStates.get(e);if(!t)return 0;t.isDragging=!1;let n=t.targetFraction;return t.trackVelocityAfterRelease=!0,this.gooseAnimStart(),n},gooseTglFrac(e){return this.toggleStates.get(e)?.fraction??0},gooseSldDragPos(e,t){let n=this.toggleStates.get(e);if(!n)return;let r=Math.max(0,Math.min(1,t));n.targetFraction!==r&&(n.targetFraction=r,this.gooseAnimStart())},gooseTglTargetGet(e){return this.toggleStates.get(e)?.targetFraction??0}},H=1,xe=300,Se=.5,Ce=Math.sqrt(xe),we=Ce*Math.sqrt(1-Se*Se),U=5e-4,Te=Math.sqrt(1e3),Ee=250,De=.6,Oe=Math.sqrt(Ee);Oe*Math.sqrt(1-De*De);var ke=250,Ae=.7,je=Math.sqrt(ke);je*Math.sqrt(1-Ae*Ae);var Me=300,Ne=.5,Pe=Math.sqrt(Me);Pe*Math.sqrt(1-Ne*Ne);function Fe(e,t,n,r){let i=e-n,a=t,o=Math.exp(-Se*Ce*r),s=Math.cos(we*r),c=Math.sin(we*r),l=i*o*s+(a+Se*Ce*i)/we*o*c,u=(a+Se*Ce*i)/we,d=-Se*Ce*l+o*(-i*we*c+u*we*s);return{current:n+l,velocity:d}}function Ie(e,t,n,r,i){let a=e-n,o=t,s=Math.exp(-i*r),c=a*s+(o+i*a)*r*s,l=-i*a*s+(o+i*a)*(s-i*r*s);return{current:n+c,velocity:l}}function Le(e,t,n,r,i,a){let o=e-n,s=t,c=i*Math.sqrt(1-a*a),l=Math.exp(-a*i*r),u=Math.cos(c*r),d=Math.sin(c*r),f=o*l*u+(s+a*i*o)/c*l*d,p=(s+a*i*o)/c,m=-a*i*f+l*(-o*c*d+p*c*u);return{current:n+f,velocity:m}}var Re={gooseTabSel(e,t,n){let r=this.gooseEnsureTgl(e,t,W.gooseTabScale,n-1);r.isDragging||r.targetFraction!==t&&(r.targetFraction=t,r.trackVelocityAfterRelease=!1,r.targetVelocity=0,r.velocity=0,r.velocityVelocity=0,r.velocityTracker.resetTracking(),r.targetPress===0&&(r.targetPress=1,r.targetScaleX=r.pressedScale,r.targetScaleY=r.pressedScale),this.gooseAnimStart())},gooseTabDragStart(e,t,n){let r=this.gooseEnsureTgl(e,t,W.gooseTabScale,n-1);r.isDragging=!0,r.targetPress=1,r.targetScaleX=r.pressedScale,r.targetScaleY=r.pressedScale,r.velocityTracker.resetTracking(),r.targetVelocity=0,r.velocity=0,r.velocityVelocity=0,this.gooseAnimStart()},gooseTabDrag(e,t,n,r,i,a){let o=this.gooseEnsureTgl(e,t,W.gooseTabScale,a-1);if(!o.isDragging)return;let s=(n-r)/Math.max(1,i);o.targetFraction=Math.max(0,Math.min(a-1,t+s));let c=i*a,l=Math.max(-1,Math.min(1,(n-r)/Math.max(1,c))),u=1-(1-Math.abs(l))**2;o.targetPanelOffset=4*H*Math.sign(l)*u,this.gooseAnimStart()},gooseTabDragEnd(e,t){let n=this.toggleStates.get(e);if(!n)return 0;n.isDragging=!1;let r=Math.round(n.targetFraction),i=Math.max(0,Math.min(t-1,r));return n.targetFraction=i,n.velocityTracker.resetTracking(),n.trackVelocityAfterRelease=!1,n.targetVelocity=0,n.targetPanelOffset=0,this.gooseAnimStart(),i},gooseTabFrac(e){return this.toggleStates.get(e)?.fraction??0},gooseTabTarget(e){return this.toggleStates.get(e)?.targetFraction??0}},ze={gooseElements(e){this.gooseButtons(e)},gooseButtons(e){let t=new Set(this.buttonConfigs.map(e=>e.id)),n=new Set(e.map(e=>e.id));for(let e of n)t.has(e)||this.fgDirtyIds.add(e);for(let t of e){let e=this.buttonConfigs.find(e=>e.id===t.id);if(!e)continue;let n=(e,t)=>{if(!e||!t)return e===t;if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(e[n]!==t[n])return!1;return!0},r=e.text?.icon,i=t.text?.icon,a=!!r!=!!i||r&&i&&(r.path!==i.path||r.size!==i.size||!n(r.color,i.color)),o=e.icon,s=t.icon,c=!!o!=!!s||o&&s&&(o.path!==s.path||o.size!==s.size||!n(o.color,s.color)),l=e.text,u=t.text,d=!!l!=!!u||l&&u&&(!n(l.color,u.color)||l.halo!==u.halo||l.fontSizePx!==u.fontSizePx||l.fontWeight!==u.fontWeight||l.align!==u.align||l.wrap!==u.wrap||l.paddingPx!==u.paddingPx||l.valign!==u.valign||l.maxLines!==u.maxLines);(e.label!==t.label||!n(e.labelColor,t.labelColor)||e.showChevron!==t.showChevron||e.rect.w!==t.rect.w||e.rect.h!==t.rect.h||t.text&&e.text&&e.text.content!==t.text.content||t.text&&!e.text||!t.text&&e.text||a||c||d)&&this.fgDirtyIds.add(t.id)}for(let e of t)if(!n.has(e)){this.buttonStates.delete(e);let t=this.fgTextures.get(e);t&&(this.gl.deleteTexture(t),this.fgTextures.delete(e)),this.fgDirtyIds.delete(e)}for(let t of e)this.buttonStates.has(t.id)||this.buttonStates.set(t.id,{pressProgress:0,pressVelocity:0,targetPress:0,dragX:0,dragY:0,dragVx:0,dragVy:0,targetDragX:0,targetDragY:0,startDragX:0,startDragY:0,interactiveValue:0,interactiveVelocity:0,targetInteractiveValue:0});this.buttonConfigs=e,this.gooseReqRender()},gooseInterVal(e,t){let n=this.buttonStates.get(e);n&&n.targetInteractiveValue!==t&&(n.targetInteractiveValue=t,this.gooseAnimStart(),this.gooseReqRender())},goosePress(e,t,n){let r=this.buttonStates.get(e);if(r){if(t){let t=this.buttonConfigs.find(t=>t.id===e);if(t&&n){let e=n.x-t.rect.x,i=n.y-t.rect.y;r.targetPress===0&&(r.startDragX=e,r.startDragY=i,r.dragX=e,r.dragY=i,r.dragVx=0,r.dragVy=0),r.dragX=e,r.dragY=i,r.dragVx=0,r.dragVy=0,r.targetDragX=e,r.targetDragY=i}r.targetPress=1}else r.targetPress=0,r.targetDragX=r.startDragX,r.targetDragY=r.startDragY;this.gooseAnimStart()}},gooseDragPos(e,t){let n=this.buttonStates.get(e);if(!n||n.targetPress===0)return;let r=this.buttonConfigs.find(t=>t.id===e);if(!r)return;let i=t.x-r.rect.x,a=t.y-r.rect.y;n.dragX=i,n.dragY=a,n.dragVx=0,n.dragVy=0,n.targetDragX=i,n.targetDragY=a,this.gooseReqRender()}},Be={gooseAnimStart(){if(this.animRafId!==null)return;let e=performance.now(),t=()=>{let n=performance.now(),r=Math.min((n-e)/1e3,.05);e=n;let i=!1;for(let e of this.buttonStates.values()){if(Math.abs(e.targetPress-e.pressProgress)>U||Math.abs(e.pressVelocity)>U){let t=Fe(e.pressProgress,e.pressVelocity,e.targetPress,r);e.pressProgress=t.current,e.pressVelocity=t.velocity,i=!0}else e.pressProgress=e.targetPress,e.pressVelocity=0;if(Math.abs(e.targetDragX-e.dragX)>U||Math.abs(e.dragVx)>U){let t=Fe(e.dragX,e.dragVx,e.targetDragX,r);e.dragX=t.current,e.dragVx=t.velocity,i=!0}else e.dragX=e.targetDragX,e.dragVx=0;if(Math.abs(e.targetDragY-e.dragY)>U||Math.abs(e.dragVy)>U){let t=Fe(e.dragY,e.dragVy,e.targetDragY,r);e.dragY=t.current,e.dragVy=t.velocity,i=!0}else e.dragY=e.targetDragY,e.dragVy=0;if(Math.abs(e.targetInteractiveValue-e.interactiveValue)>U||Math.abs(e.interactiveVelocity)>U){let t=Fe(e.interactiveValue,e.interactiveVelocity,e.targetInteractiveValue,r);e.interactiveValue=t.current,e.interactiveVelocity=t.velocity,i=!0}else e.interactiveValue=e.targetInteractiveValue,e.interactiveVelocity=0}for(let e of this.toggleStates.values()){if(e.targetPress===1&&!e.isDragging&&Math.abs(e.targetFraction-e.fraction)<.02&&(e.targetPress=0,e.targetScaleX=1,e.targetScaleY=1,this.gooseAnimStart()),Math.abs(e.targetFraction-e.fraction)>U||Math.abs(e.fractionVelocity)>U){let t=Ie(e.fraction,e.fractionVelocity,e.targetFraction,r,Te);if(e.fraction=t.current,e.fractionVelocity=t.velocity,e.trackVelocityAfterRelease||e.isDragging){let t=performance.now();e.velocityTracker.addPosition(t,e.fraction),e.targetVelocity=e.velocityTracker.calculateVelocity()/(e.valueRangeSpan||1)}i=!0}else e.fraction=e.targetFraction,e.fractionVelocity=0,e.isDragging||(e.targetVelocity=0,e.trackVelocityAfterRelease=!1,e.velocityTracker.resetTracking());if(Math.abs(e.targetPress-e.pressProgress)>U||Math.abs(e.pressVelocity)>U){let t=Ie(e.pressProgress,e.pressVelocity,e.targetPress,r,Te);e.pressProgress=t.current,e.pressVelocity=t.velocity,i=!0}else e.pressProgress=e.targetPress,e.pressVelocity=0;if(Math.abs(e.targetScaleX-e.scaleX)>U||Math.abs(e.scaleXVelocity)>U){let t=Le(e.scaleX,e.scaleXVelocity,e.targetScaleX,r,Oe,De);e.scaleX=t.current,e.scaleXVelocity=t.velocity,i=!0}else e.scaleX=e.targetScaleX,e.scaleXVelocity=0;if(Math.abs(e.targetScaleY-e.scaleY)>U||Math.abs(e.scaleYVelocity)>U){let t=Le(e.scaleY,e.scaleYVelocity,e.targetScaleY,r,je,Ae);e.scaleY=t.current,e.scaleYVelocity=t.velocity,i=!0}else e.scaleY=e.targetScaleY,e.scaleYVelocity=0;if(Math.abs(e.targetVelocity-e.velocity)>U||Math.abs(e.velocityVelocity)>U){let t=Le(e.velocity,e.velocityVelocity,e.targetVelocity,r,Pe,Ne);e.velocity=t.current,e.velocityVelocity=t.velocity,i=!0}else e.velocity=e.targetVelocity,e.velocityVelocity=0;if(Math.abs(e.targetPanelOffset-e.panelOffset)>U||Math.abs(e.panelOffsetVelocity)>U){let t=Ie(e.panelOffset,e.panelOffsetVelocity,e.targetPanelOffset,r,Math.sqrt(300));e.panelOffset=t.current,e.panelOffsetVelocity=t.velocity,i=!0}else e.panelOffset=e.targetPanelOffset,e.panelOffsetVelocity=0}if(Math.abs(this.scrollVelocity)>.5){let e=this.scrollY+this.scrollVelocity*r,t=this.gooseClampScroll(e);t===e?(this.scrollY=t,this.scrollVelocity*=Math.exp(-4*r)):(this.scrollY=t,this.scrollVelocity=0),i=!0}else this.scrollVelocity=0;this.gooseReqRender(),this.animRafId=i?requestAnimationFrame(t):null};this.animRafId=requestAnimationFrame(t)},gooseReqRender(){this.needsRedraw=!0,this.rafId===null&&(this.rafId=requestAnimationFrame(()=>{this.rafId=null,this.gooseRender()}))}},Ve={gooseRaster(e){if(e.kind===`text`&&e.text){this.gooseRasterText(e);return}if(e.kind!==`button`&&!e.label&&!e.icon){this.fgDirtyIds.delete(e.id);return}let t=this.dpr,n=Math.max(1,Math.round(e.rect.w*t)),r=Math.max(1,Math.round(e.rect.h*t));this.fgCanvas.width!==n&&(this.fgCanvas.width=n),this.fgCanvas.height!==r&&(this.fgCanvas.height=r);let i=this.fgCtx;i.setTransform(1,0,0,1,0,0),i.clearRect(0,0,n,r),i.scale(t,t);let a=e.rect.w,o=e.rect.h;if(e.icon){let t=e.icon.size,n=e.icon.color;i.save(),i.translate(a/2-t/2,o/2-t/2);let r=e.icon.viewport??24;i.scale(t/r,t/r);let s=new Path2D(e.icon.path);i.fillStyle=`rgba(${Math.round(n[0]*255)}, ${Math.round(n[1]*255)}, ${Math.round(n[2]*255)}, ${n[3]})`,i.fill(s),i.restore(),this.gooseUploadRaster(e.id),this.fgDirtyIds.delete(e.id);return}let s=e.labelFontSizePx??15/48*o;i.font=`400 ${s}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,i.textBaseline=`middle`,i.textAlign=`center`;let c=`rgba(${Math.round(e.labelColor[0]*255)}, ${Math.round(e.labelColor[1]*255)}, ${Math.round(e.labelColor[2]*255)}, ${e.labelColor[3]})`,l=e.labelColor[0]+e.labelColor[1]+e.labelColor[2]<1.5;if(i.save(),i.shadowColor=l?`rgba(255,255,255,0.45)`:`rgba(0,0,0,0.15)`,i.shadowBlur=l?s*.12:s*.05,i.fillStyle=c,i.fillText(e.label,a/2,o/2+.5),i.restore(),e.showChevron){let t=s*.93,n=i.measureText(e.label).width,r=a/2+n/2+s*.53+t/2,l=o/2;i.save(),i.strokeStyle=c,i.globalAlpha=.6,i.lineWidth=s*.107,i.lineCap=`round`,i.lineJoin=`round`,i.beginPath(),i.moveTo(r-t*.3,l-t*.4),i.lineTo(r+t*.2,l),i.lineTo(r-t*.3,l+t*.4),i.stroke(),i.restore()}this.gooseUploadRaster(e.id),this.fgDirtyIds.delete(e.id)},gooseRasterText(e){if(!e.text)return;let t=this.dpr,n=Math.max(1,Math.round(e.rect.w*t)),r=Math.max(1,Math.round(e.rect.h*t));this.fgCanvas.width!==n&&(this.fgCanvas.width=n),this.fgCanvas.height!==r&&(this.fgCanvas.height=r);let i=this.fgCtx;i.setTransform(1,0,0,1,0,0),i.clearRect(0,0,n,r),i.scale(t,t);let a=e.text,o=e.rect.w,s=e.rect.h;i.font=`${a.fontWeight} ${a.fontSizePx}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,i.textBaseline=`middle`;let c=a.paddingPx??0,l=`none`;a.halo===`light`?l=`light`:a.halo===`dark`?l=`dark`:(a.halo===`auto`||a.halo===void 0)&&(l=a.color[0]+a.color[1]+a.color[2]<1.5?`light`:`dark`),l===`light`?(i.shadowColor=`rgba(255,255,255,0.55)`,i.shadowBlur=a.fontSizePx*.16):l===`dark`?(i.shadowColor=`rgba(0,0,0,0.28)`,i.shadowBlur=a.fontSizePx*.1):(i.shadowColor=`transparent`,i.shadowBlur=0),i.fillStyle=`rgba(${Math.round(a.color[0]*255)}, ${Math.round(a.color[1]*255)}, ${Math.round(a.color[2]*255)}, ${a.color[3]})`;let u=0;if(a.icon){let e=a.icon.size,t=a.icon.layoutSize??e,n=a.content?2:0,r=t+n+(a.content?a.fontSizePx:0),c=s/2-r/2,l=o/2,d=c+t/2;i.save(),i.translate(l-e/2,d-e/2);let f=a.icon.viewport??24;i.scale(e/f,e/f);let p=new Path2D(a.icon.path),m=a.icon.color;i.fillStyle=`rgba(${Math.round(m[0]*255)}, ${Math.round(m[1]*255)}, ${Math.round(m[2]*255)}, ${m[3]})`,i.fill(p),i.restore(),u=(t+n)/2}if(a.align===`center`){if(i.textAlign=`center`,a.wrap){let e=te(i,a.content,o-c*2);a.maxLines!=null&&e.length>a.maxLines&&(e=e.slice(0,a.maxLines));let t=a.fontSizePx*1.35,n=t*e.length,r;r=a.valign===`top`?t/2+u:a.valign===`bottom`?s-n+t/2+u:s/2-n/2+t/2+u;for(let n of e)i.fillText(n,o/2,r),r+=t}else i.fillText(a.content,o/2,s/2+.5+u)}else if(a.align===`left`){if(i.textAlign=`left`,a.wrap){let e=te(i,a.content,o-c*2);a.maxLines!=null&&e.length>a.maxLines&&(e=e.slice(0,a.maxLines));let t=a.fontSizePx*1.35,n=t*e.length,r;r=a.valign===`top`?t/2+u:a.valign===`bottom`?s-n+t/2+u:s/2-n/2+t/2+u;for(let n of e)i.fillText(n,c,r),r+=t}else i.fillText(a.content,c,s/2+.5+u)}else i.textAlign=`right`,i.fillText(a.content,o-c,s/2+.5+u);this.gooseUploadRaster(e.id),this.fgDirtyIds.delete(e.id)},gooseUploadRaster(e){let t=this.gl,n=this.fgTextures.get(e);n||(n=t.createTexture(),this.fgTextures.set(e,n)),t.bindTexture(t.TEXTURE_2D,n),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),L(t,this.fgCanvas,!0),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1)}},He={gooseRender(){if(!this.needsRedraw||(this.needsRedraw=!1,!this.wallpaperReady&&!this.backgroundColor))return;let e=this.gl;this.transparentBackdrop&&(this.transparentGlassRect=null,this.transparentIndicatorRect=null),this.gooseResizeFBO(this.canvas.width,this.canvas.height);for(let e of this.buttonConfigs)this.fgDirtyIds.has(e.id)&&this.gooseRaster(e);if(this.gooseRenderBG(),this.buttonConfigs.length===0){this.gooseBindFBO(null),this.gooseCopyToCanvas(this.fboATex);return}let t=this.buttonConfigs.find(e=>(e.sceneBlurRadius??0)>=.5);if(t){let e=t.sceneBlurRadius*this.dpr,n=this.gooseBlur(this.fboATex,e);this.gooseBindFBO(this.fboA),this.gooseCopy(n)}e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA);let n=this.scrollY,r=-120,i=this.cssHeight+120,a=e=>{let t=e.scroll?e.rect.y-n:e.rect.y;return{x:e.rect.x,y:t,w:e.rect.w,h:e.rect.h}},o=this.fboA,s=this.fboATex,c=this.fboB,l=this.fboBTex;for(let e of this.buttonConfigs){if(e.renderOnTop)continue;let t=e.scroll?e.rect.y-n:e.rect.y;if(t+e.rect.h<r||t>i)continue;let u=a(e),d=this.buttonStates.get(e.id);if(this.gooseRenderPlain(e,u,d,o))continue;e.backdropFbo&&e.scrimColor&&this.gooseRenderDlg(e.scrimColor,e.brightness,e.contrast,e.saturation),e.useContinuousSdf&&this.gooseLoadCSDF(e.rect.w,e.rect.h,e.cornerRadius);let f=this.gooseRenderGlass(e,d,o,s,c,l,u);o=f.curFbo,s=f.curTex,c=f.otherFbo,l=f.otherTex,e.isBottomTabContainer&&this.tabsBackdropFbo&&this.tabsBackdropTex&&(this.gooseBindFBO(this.tabsBackdropFbo),this.gl.clearColor(0,0,0,0),this.gl.clear(this.gl.COLOR_BUFFER_BIT),this.gooseCopy(s),this.gooseBindFBO(o),this.gl.enable(this.gl.BLEND),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA))}for(let e of this.buttonConfigs){if(!e.renderOnTop)continue;let t=e.scroll?e.rect.y-n:e.rect.y;if(t+e.rect.h<r||t>i)continue;let u=a(e),d=this.buttonStates.get(e.id);if(this.gooseRenderPlain(e,u,d,o))continue;let f=this.gooseRenderGlass(e,d,o,s,c,l,u);o=f.curFbo,s=f.curTex,c=f.otherFbo,l=f.otherTex}this.gooseBindFBO(null),this.gooseCopyToCanvas(s)},gooseSDFUniforms(e,t,n,r){let i=this.gl;i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(t),i.vertexAttribPointer(t,2,i.FLOAT,!1,0,0),i.uniform2f(e.uCanvasSize,this.canvas.width,this.canvas.height),i.uniform2f(e.uOffset,n.x*this.dpr,n.y*this.dpr),i.uniform2f(e.uSize,n.w*this.dpr,n.h*this.dpr),i.uniform4f(e.uCornerRadii,r*this.dpr,r*this.dpr,r*this.dpr,r*this.dpr)},gooseRenderBG(){let e=this.gl;if(this.gooseBindFBO(this.fboA),e.disable(e.BLEND),this.backgroundColor){let[e,t,n]=this.backgroundColor;this.gooseFill(e,t,n,1)}else e.useProgram(this.wallpaperProgram),e.bindBuffer(e.ARRAY_BUFFER,this.quadBuffer),e.enableVertexAttribArray(this.aPosLocWp),e.vertexAttribPointer(this.aPosLocWp,2,e.FLOAT,!1,0,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,this.wallpaperTexture),e.uniform1i(this.uWp.uBackdrop,0),e.uniform2f(this.uWp.uCanvasSize,this.canvas.width,this.canvas.height),e.uniform2f(this.uWp.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),e.drawArrays(e.TRIANGLES,0,6)},gooseRenderDlg(e,t,n,r){let i=`${e.join(`,`)}|${t},${n},${r}`;if(this.dialogBackdropKey===i)return;this.dialogBackdropKey=i;let a=this.gl;if(this.gooseBindFBO(this.dialogBackdropFbo),a.disable(a.BLEND),this.backgroundColor){let[e,t,n]=this.backgroundColor;this.gooseFill(e,t,n,1)}else a.useProgram(this.wallpaperProgram),a.bindBuffer(a.ARRAY_BUFFER,this.quadBuffer),a.enableVertexAttribArray(this.aPosLocWp),a.vertexAttribPointer(this.aPosLocWp,2,a.FLOAT,!1,0,0),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,this.wallpaperTexture),a.uniform1i(this.uWp.uBackdrop,0),a.uniform2f(this.uWp.uCanvasSize,this.canvas.width,this.canvas.height),a.uniform2f(this.uWp.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),a.drawArrays(a.TRIANGLES,0,6);e[3]>.001&&(a.enable(a.BLEND),a.blendFuncSeparate(a.SRC_ALPHA,a.ONE_MINUS_SRC_ALPHA,a.ONE,a.ONE_MINUS_SRC_ALPHA),this.gooseFill(e[0],e[1],e[2],e[3]),a.blendFunc(a.SRC_ALPHA,a.ONE_MINUS_SRC_ALPHA)),this.gooseBindFBO(this.blurFboA),this.gooseColorCtrl(this.dialogBackdropTex,t,n,r),this.gooseBindFBO(this.dialogBackdropFbo),this.gooseCopy(this.blurFboATex)},gooseRenderPlain(e,t,n,r){let i=this.gl,a=t;if(e.enterProgress!=null){let n=e.enterProgress,r=n<0?(1-Math.exp(-Math.abs(n)))*-1:n<=1?n:1+(1-Math.exp(-(n-1))),i=-48*H*(1-r),o=e.enterStretchFactor!=null&&r>1?e.enterStretchFactor*(r-1)*32*H:0;a={x:t.x,y:t.y+i+o,w:t.w,h:t.h}}if(e.kind===`plain-rect`&&e.plainRect){let n=e.isToggleTrack?null:e.plainRect.color;if(n&&n[3]<=0)return!0;this.gooseBindFBO(r);let o;if(e.isToggleTrack){let t=this.toggleStates.get(e.isToggleTrack.groupId),n=t?t.fraction:0,r=e.isToggleTrack.offColor,i=e.isToggleTrack.onColor;o=[r[0]+(i[0]-r[0])*n,r[1]+(i[1]-r[1])*n,r[2]+(i[2]-r[2])*n,r[3]+(i[3]-r[3])*n]}else o=e.plainRect.color;let s=a;if(e.isSliderFill){let n=this.toggleStates.get(e.isSliderFill.groupId),r=n?n.fraction:0,i=Math.max(e.isSliderFill.minW,e.isSliderFill.trackW*r);s={x:t.x,y:t.y,w:i,h:t.h}}i.useProgram(this.plainRectProgram),this.gooseSDFUniforms(this.uPr,this.aPosLocPr,s,e.cornerRadius),i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);let c=e.enterProgress==null?1:ne(e.enterSafeProgress==null?Math.max(0,Math.min(1,e.enterProgress)):Math.max(0,Math.min(1,e.enterSafeProgress)));return i.uniform4f(this.uPr.uColor,o[0],o[1],o[2],o[3]*c),i.uniform1f(this.uPr.uCornerStyle,this.cornerStyle),e.useContinuousSdf&&this.continuousSdfTexture?(i.activeTexture(i.TEXTURE2),i.bindTexture(i.TEXTURE_2D,this.continuousSdfTexture),i.uniform1i(this.uPr.uContinuousSdf,2),i.uniform1f(this.uPr.uUseContinuousSdf,1),i.uniform2f(this.uPr.uContinuousSdfTexSize,this.continuousSdfTexSize[0],this.continuousSdfTexSize[1]),i.uniform2f(this.uPr.uContinuousSdfElementSize,a.w*this.dpr,a.h*this.dpr)):i.uniform1f(this.uPr.uUseContinuousSdf,0),i.drawArrays(i.TRIANGLES,0,6),!0}if(e.kind===`progressive-blur`&&e.progressiveBlur){this.gooseBindFBO(r),i.useProgram(this.progressiveBlurProgram),this.gooseSDFUniforms(this.uPb,this.aPosLocPb,a,e.cornerRadius),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,this.wallpaperTexture),i.uniform1i(this.uPb.uBackdrop,0),i.uniform2f(this.uPb.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),i.uniform1f(this.uPb.uBlurRadius,e.progressiveBlur.blurRadius*this.dpr);let t=e.progressiveBlur.tintColor;return i.uniform4f(this.uPb.uTintColor,t[0],t[1],t[2],t[3]),i.uniform1f(this.uPb.uTintIntensity,e.progressiveBlur.tintIntensity),i.drawArrays(i.TRIANGLES,0,6),!0}if(e.kind===`text`){this.gooseBindFBO(r);let t=a,o=1,s=1;if(e.isBottomTabContent){let n=this.toggleStates.get(e.isBottomTabContent.groupId);if(n){let r=e.isBottomTabContent.containerWidth??e.rect.w*4,i=1+16*H/r*n.pressProgress;o=i,s=i;let a=e.isBottomTabContent.containerCenterX??e.rect.x+e.rect.w/2,c=e.isBottomTabContent.containerCenterY??e.rect.y+e.rect.h/2,l=e.rect.x+e.rect.w/2,u=e.rect.y+e.rect.h/2,d=a+(l-a)*i+n.panelOffset,f=c+(u-c)*i,p=e.rect.w*o,m=e.rect.h*s;t={x:d-p/2,y:f-m/2,w:p,h:m}}}let c=n?.pressProgress??0;if(e.isInteractive&&c>.001){let n=e.pressTintColor;i.useProgram(this.tintProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocTn),i.vertexAttribPointer(this.aPosLocTn,2,i.FLOAT,!1,0,0),n?i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA):i.blendFunc(i.SRC_ALPHA,i.ONE),i.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),i.uniform2f(this.uTn.uOffset,t.x*this.dpr,t.y*this.dpr),i.uniform2f(this.uTn.uSize,t.w*this.dpr,t.h*this.dpr),i.uniform4f(this.uTn.uCornerRadii,0,0,0,0),i.uniform2f(this.uTn.uOriginalSize,t.w*this.dpr,t.h*this.dpr),i.uniform1f(this.uTn.uOriginalCornerRadius,0),i.uniform2f(this.uTn.uLayerScale,1,1),n?i.uniform4f(this.uTn.uColor,n[0],n[1],n[2],.1*c):i.uniform4f(this.uTn.uColor,1,1,1,.1*c),i.drawArrays(i.TRIANGLES,0,6),i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA)}let l=this.fgTextures.get(e.id);return l&&(i.useProgram(this.foregroundProgram),i.bindBuffer(i.ARRAY_BUFFER,this.quadBuffer),i.enableVertexAttribArray(this.aPosLocFg),i.vertexAttribPointer(this.aPosLocFg,2,i.FLOAT,!1,0,0),i.blendFunc(i.ONE,i.ONE_MINUS_SRC_ALPHA),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,l),i.uniform1i(this.uFg.uTexture,0),i.uniform2f(this.uFg.uCanvasSize,this.canvas.width,this.canvas.height),i.uniform2f(this.uFg.uOffset,t.x*this.dpr,t.y*this.dpr),i.uniform2f(this.uFg.uSize,t.w*this.dpr,t.h*this.dpr),i.uniform4f(this.uFg.uCornerRadii,e.cornerRadius*this.dpr,e.cornerRadius*this.dpr,e.cornerRadius*this.dpr,e.cornerRadius*this.dpr),i.uniform2f(this.uFg.uOriginalSize,e.rect.w*this.dpr,e.rect.h*this.dpr),i.uniform1f(this.uFg.uOriginalCornerRadius,e.cornerRadius*this.dpr),i.uniform2f(this.uFg.uLayerScale,o,s),i.uniform1f(this.uFg.uCornerStyle,this.cornerStyle),i.uniform1f(this.uFg.uAlpha,e.enterProgress==null?1:ne(e.enterSafeProgress==null?Math.max(0,Math.min(1,e.enterProgress)):Math.max(0,Math.min(1,e.enterSafeProgress)))),i.drawArrays(i.TRIANGLES,0,6),i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA)),!0}return!1}},Ue={gooseRenderGlass(e,t,n,r,i,a,o){let s=this.gl,c=e.kind===`button`,l=t?.pressProgress??0,u=4/48,d=1,f=0,p=0,m=1,h=1;if(e.enterProgress!=null){let t=e.enterProgress,n=t<0?(1-Math.exp(-Math.abs(t)))*-1:t<=1?t:1+(1-Math.exp(-(t-1)));p+=-48*H*(1-n),e.enterStretchFactor!=null&&n>1&&(p+=e.enterStretchFactor*(n-1)*32*H);let r=1+.1*Math.max(0,n-1);m/=r,h*=r}if(c&&e.isInteractive&&t){let n=e.rect.w,r=e.rect.h,i=Math.max(n,r),a=Math.min(n,r),o=.05,s=u;d=1+u*l;let c=t.dragX-t.startDragX,g=t.dragY-t.startDragY;f=a*Math.tanh(o*c/a),p=a*Math.tanh(o*g/a);let _=Math.atan2(g,c),v=Math.min(n/r,1),y=Math.min(r/n,1);m=d+s*Math.abs(Math.cos(_)*c/i)*v,h=d+s*Math.abs(Math.sin(_)*g/i)*y}else e.enterProgress??(m=d,h=d);let g=0,_=1,v=1,y=0;if(e.isToggleKnob){let t=this.toggleStates.get(e.isToggleKnob.groupId);if(t){g=t.fraction*e.isToggleKnob.dragWidth,_=t.scaleX,v=t.scaleY,y=t.pressProgress;let n=e.isToggleKnob.velocityDivisor??50,r=t.velocity/n,i=Math.max(-.2,Math.min(.2,r*.75)),a=Math.max(-.2,Math.min(.2,r*.25));_/=1-i,v*=1-a}}if(m*=_,h*=v,e.isBottomTabContainer){let t=this.toggleStates.get(e.isBottomTabContainer.groupId);if(t){let n=1+16*H/e.rect.w*t.pressProgress;m*=n,h*=n,f+=t.panelOffset,y=t.pressProgress}}if(e.isBottomTabContent){let t=this.toggleStates.get(e.isBottomTabContent.groupId);if(t){let n=e.isBottomTabContent.containerWidth??e.rect.w,r=1+16*H/n*t.pressProgress;m*=r;let i=1+.2*t.pressProgress;m*=i,h*=r*i,f+=t.panelOffset}}if(e.isBottomTabIndicator){let t=this.toggleStates.get(e.isBottomTabIndicator.groupId);if(t){g+=t.fraction*e.isBottomTabIndicator.dragWidth,g+=t.panelOffset;let n=t.scaleX,r=t.scaleY,i=t.velocity/10,a=Math.max(-.2,Math.min(.2,i*.75)),o=Math.max(-.2,Math.min(.2,i*.25)),s=n/(1-a),c=r*(1-o);m*=s,h*=c,y=Math.max(y,t.pressProgress)}}let b,x;b=o.x+e.rect.w/2+f+g,x=o.y+e.rect.h/2+p;let S=e.rect.w*m,C=e.rect.h*h,w=b-S/2,T=x-C/2;if(this.transparentBackdrop){let t=[w*this.dpr,T*this.dpr,S*this.dpr,C*this.dpr];e.isBottomTabContainer?(this.transparentGlassRect=t,this.transparentGlassAlpha=e.surfaceColor?.[3]||0):e.isBottomTabIndicator&&(this.transparentIndicatorRect=t,this.transparentIndicatorAlpha=.1+.12*y)}let E=e.cornerRadius*Math.min(m,h),D=[E,E,E,E];this.gooseBindFBO(i),this.gooseCopy(r),s.enable(s.BLEND),s.blendFunc(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA);let O=Math.max(0,Math.round((w-60)*this.dpr)),k=Math.max(0,Math.round((this.cssHeight-(T+C+60))*this.dpr)),A=Math.min(this.fboW-O,Math.round((S+120)*this.dpr)),j=Math.min(this.fboH-k,Math.round((C+120)*this.dpr));s.enable(s.SCISSOR_TEST),s.scissor(O,k,A,j);let M={el:e,st:t,isButton:c,p:l,sx:w,sy:T,sw:S,sh:C,radii:D,togglePressProgress:y,elHighlightAlpha:e.isToggleKnob||e.isBottomTabIndicator?0:e.highlight?e.highlight.alpha:0,enterAlpha:e.enterProgress==null?1:ne(e.enterSafeProgress==null?Math.max(0,Math.min(1,e.enterProgress)):Math.max(0,Math.min(1,e.enterSafeProgress))),layerScaleX:m,layerScaleY:h,layerScale:Math.min(m,h),origW:e.rect.w,origH:e.rect.h,origCornerRadius:e.cornerRadius,elementRotation:e.elementRotation??0};if(this.gooseGlassShadow(M),e.useSeparableBlur&&e.blurRadius>=.5){let t=e.blurRadius*M.layerScale*this.dpr,n=e.backdropFbo&&this.dialogBackdropTex?this.dialogBackdropTex:r,a=this.gooseBlur(n,t);this.gl.enable(this.gl.BLEND),this.gl.blendFunc(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA),this.gooseBindFBO(i),this.gl.viewport(0,0,this.fboW,this.fboH);let o=e.backdropFbo?{...M,el:{...e,backdropFbo:!1}}:M;this.gooseGlassPass(o,a)}else this.gooseGlassPass(M,r);return this.gooseGlassPost(M),s.disable(s.SCISSOR_TEST),{curFbo:i,curTex:a,otherFbo:n,otherTex:r}},gooseGlassShadow(e){let t=this.gl,{el:n,sx:r,sy:i,sw:a,sh:o,radii:s}=e;if(!n.outerShadow||n.outerShadow.alpha<=.001||n.outerShadow.radius<=.5)return;let c=n.outerShadow.alpha;n.isBottomTabIndicator&&(c=n.outerShadow.alpha*e.togglePressProgress,c<=.001)||(t.useProgram(this.shadowProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocSh),t.vertexAttribPointer(this.aPosLocSh,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.uniform2f(this.uSh.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uSh.uElementOffset,r*this.dpr,i*this.dpr),t.uniform2f(this.uSh.uElementSize,a*this.dpr,o*this.dpr),t.uniform4f(this.uSh.uCornerRadii,s[0]*this.dpr,s[1]*this.dpr,s[2]*this.dpr,s[3]*this.dpr),t.uniform2f(this.uSh.uOriginalSize,e.origW*this.dpr,e.origH*this.dpr),t.uniform1f(this.uSh.uOriginalCornerRadius,e.origCornerRadius*this.dpr),t.uniform2f(this.uSh.uLayerScale,e.layerScaleX,e.layerScaleY),t.uniform1f(this.uSh.uElementRotation,e.elementRotation),t.uniform1f(this.uSh.uCornerStyle,this.cornerStyle),t.uniform1f(this.uSh.uShadowRadius,n.outerShadow.radius*this.dpr),t.uniform2f(this.uSh.uShadowOffset,n.outerShadow.offsetX*this.dpr,n.outerShadow.offsetY*this.dpr),t.uniform4f(this.uSh.uShadowColor,n.outerShadow.color[0],n.outerShadow.color[1],n.outerShadow.color[2],c),t.drawArrays(t.TRIANGLES,0,6))}},We={gooseGlassPass(e,t){let n=this.gl,{el:r,sx:i,sy:a,sw:o,sh:s,radii:c,togglePressProgress:l,layerScale:u}=e;n.useProgram(this.elementProgram),n.bindBuffer(n.ARRAY_BUFFER,this.quadBuffer),n.enableVertexAttribArray(this.aPosLocEl),n.vertexAttribPointer(this.aPosLocEl,2,n.FLOAT,!1,0,0),n.blendFunc(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,t),n.uniform1i(this.uEl.uBackdrop,0),this.wallpaperTexture&&(n.activeTexture(n.TEXTURE1),n.bindTexture(n.TEXTURE_2D,this.wallpaperTexture),n.uniform1i(this.uEl.uWallpaperSampler,1)),n.uniform2f(this.uEl.uCanvasSize,this.canvas.width,this.canvas.height),n.uniform2f(this.uEl.uWallpaperSize,this.wallpaperSize[0],this.wallpaperSize[1]),n.uniform2f(this.uEl.uElementOffset,i*this.dpr,a*this.dpr),n.uniform2f(this.uEl.uElementSize,o*this.dpr,s*this.dpr),n.uniform4f(this.uEl.uCornerRadii,c[0]*this.dpr,c[1]*this.dpr,c[2]*this.dpr,c[3]*this.dpr),n.uniform2f(this.uEl.uOriginalSize,e.origW*this.dpr,e.origH*this.dpr),n.uniform1f(this.uEl.uOriginalCornerRadius,e.origCornerRadius*this.dpr),n.uniform2f(this.uEl.uLayerScale,e.layerScaleX,e.layerScaleY),n.uniform1f(this.uEl.uElementRotation,r.elementRotation??0);let d=r.refractionHeight,f=r.refractionAmount,p=r.blurRadius,m=r.highlight?r.highlight.alpha:0;r.innerShadow&&r.innerShadow.alpha,r.innerShadow&&r.innerShadow.radius,r.innerShadow&&r.innerShadow.offsetX,r.innerShadow&&r.innerShadow.offsetY;let h=r.surfaceColor[3];if(r.isBottomTabIndicator){let e=l;d=r.refractionHeight*e,f=r.refractionAmount*e,p=0,m=(r.highlight?.alpha??0)*e,(r.innerShadow?.alpha??0)*e,(r.innerShadow?.radius??0)*e,(r.innerShadow?.offsetX??0)*e,(r.innerShadow?.offsetY??0)*e}let g=1,_=1,v=0,y=0,b=1,x=1,S=1,C=1,w=0,T=0,E=0,D=0,O=0,k=0,A=0,j=0,M=0;if(r.isToggleKnob){let e=l;d=r.refractionHeight*e,f=r.refractionAmount*e,p=8*(1-e),m=(r.highlight?.alpha??0)*e,(r.innerShadow?.alpha??0)*e,(r.innerShadow?.radius??0)*e,(r.innerShadow?.offsetX??0)*e,(r.innerShadow?.offsetY??0)*e,h=0;let t=r.isToggleKnob.velocityDivisor===10,n=t?1:.75,c=t?1:.75;if(g=2/3+(n-2/3)*e,_=0+(c-0)*e,r.isToggleKnob.trackColorOff&&r.isToggleKnob.trackColorOn&&r.isToggleKnob.trackW&&r.isToggleKnob.trackH){let t=this.toggleStates.get(r.isToggleKnob.groupId),l=t?t.fraction:0,u=r.isToggleKnob.trackColorOff,d=r.isToggleKnob.trackColorOn;w=u[0]+(d[0]-u[0])*l,T=u[1]+(d[1]-u[1])*l,E=u[2]+(d[2]-u[2])*l,D=u[3]+(d[3]-u[3])*l;let f=(i+o/2)*this.dpr,p=(a+s/2)*this.dpr,m=r.isToggleKnob.trackOriginalX??r.rect.x,h=r.isToggleKnob.trackOriginalY??r.rect.y,N=(m+r.isToggleKnob.trackW/2)*this.dpr,P=(h+r.isToggleKnob.trackH/2)*this.dpr,F=2/3+(n-2/3)*e,I=0+(c-0)*e;O=f+(N-f)*F,k=p+(P-p)*I;let ee=r.isToggleKnob.trackW*this.dpr,L=r.isToggleKnob.trackH*this.dpr;if(A=ee*F*.5,j=L*I*.5,M=L*.5*Math.min(F,I),v=1,r.isToggleKnob.solidBackdropColor){let e=r.isToggleKnob.solidBackdropColor;b=e[0],x=e[1],S=e[2],C=e[3],y=1}g=1,_=1}}let N=0,P=0,F=0,I=0,ee=0,L=0,R=0,z=0,te=0,ne=0;if(r.isBottomTabIndicator){let e=l;if(d=r.refractionHeight*e,f=r.refractionAmount*e,m=(r.highlight?.alpha??0)*e,(r.innerShadow?.alpha??0)*e,(r.innerShadow?.radius??0)*e,(r.innerShadow?.offsetX??0)*e,(r.innerShadow?.offsetY??0)*e,r.isBottomTabIndicator.accentColor&&r.isBottomTabIndicator.containerRect){let e=r.isBottomTabIndicator.accentColor,t=r.isBottomTabIndicator.containerRect;R=e[0],z=e[1],te=e[2],ne=1,P=(t.x+t.w/2)*this.dpr,F=(t.y+t.h/2)*this.dpr,I=t.w/2*this.dpr,ee=t.h/2*this.dpr,L=t.h/2*this.dpr,N=1}}if(n.uniform1f(this.uEl.uUseToggleBackdrop,v),n.uniform1f(this.uEl.uUseSolidBackdrop,y),n.uniform4f(this.uEl.uSolidBackdropColor,b,x,S,C),n.uniform4f(this.uEl.uTrackColor,w,T,E,D),n.uniform4f(this.uEl.uTrackRect,O,k,A,j),n.uniform1f(this.uEl.uTrackCornerRadius,M),n.uniform1f(this.uEl.uIndicatorBackdrop,N),n.uniform4f(this.uEl.uContainerRect,P,F,I,ee),n.uniform1f(this.uEl.uContainerCornerRadius,L),n.uniform4f(this.uEl.uIndicatorAccent,R,z,te,ne),n.uniform1f(this.uEl.uInsetPx,4*this.dpr),r.isBottomTabIndicator){let e=this.toggleStates.get(r.isBottomTabIndicator.groupId);n.uniform1f(this.uEl.uIndicatorPressProgress,e?e.pressProgress:0),n.uniform1f(this.uEl.uIndicatorPanelOffset,e?e.panelOffset*this.dpr:0),n.uniform1f(this.uEl.uDpr,this.dpr);let t=r.isBottomTabIndicator.containerCenterX??0,i=r.isBottomTabIndicator.containerCenterY??0,a=r.isBottomTabIndicator.containerWidth??r.rect.w,o=e?1+16*H/a*e.pressProgress:1;n.uniform2f(this.uEl.uContainerCenter,t*this.dpr,i*this.dpr),n.uniform1f(this.uEl.uContainerScale,o);let s=r.isBottomTabIndicator.tabContentIds??[],c=r.isBottomTabIndicator.tabContentRects??[],l=Math.min(s.length,c.length,8),u=0;for(let e=0;e<8;e++)if(e<l){let t=this.fgTextures.get(s[e]);if(t){n.activeTexture(n.TEXTURE3+u),n.bindTexture(n.TEXTURE_2D,t),n.uniform1i(this.uEl[`uTabContentTex${u}`],3+u);let r=c[e];n.uniform4f(this.uEl[`uTabContentRects[${u}]`],(r.x+r.w/2)*this.dpr,(r.y+r.h/2)*this.dpr,r.w/2*this.dpr,r.h/2*this.dpr),u++}}for(let e=u;e<8;e++)n.uniform4f(this.uEl[`uTabContentRects[${e}]`],0,0,0,0);n.uniform1f(this.uEl.uTabContentCount,u),this.tabsBackdropTex&&(n.activeTexture(n.TEXTURE11),n.bindTexture(n.TEXTURE_2D,this.tabsBackdropTex),n.uniform1i(this.uEl.uTabsGlassLayer,11))}else n.uniform1f(this.uEl.uIndicatorPressProgress,0),n.uniform1f(this.uEl.uIndicatorPanelOffset,0),n.uniform1f(this.uEl.uDpr,this.dpr),n.uniform2f(this.uEl.uContainerCenter,0,0),n.uniform1f(this.uEl.uContainerScale,1),n.uniform1f(this.uEl.uTabContentCount,0);n.uniform1f(this.uEl.uRefractionHeight,d*this.dpr),n.uniform1f(this.uEl.uRefractionAmount,f*this.dpr),n.uniform1f(this.uEl.uDepthEffect,+!!r.depthEffect),n.uniform1f(this.uEl.uChromaticAberration,+!!r.chromaticAberration);let re=r.useSeparableBlur&&r.blurRadius>=.5?0:p;if(n.uniform1f(this.uEl.uBlurRadius,re*u*this.dpr),n.uniform1f(this.uEl.uSaturation,r.saturation),n.uniform1f(this.uEl.uBrightness,r.brightness),n.uniform1f(this.uEl.uContrast,r.contrast),n.uniform1f(this.uEl.uContentScaleX,g),n.uniform1f(this.uEl.uContentScaleY,_),n.uniform4f(this.uEl.uTintColor,r.tintColor[0],r.tintColor[1],r.tintColor[2],r.tintColor[3]),n.uniform4f(this.uEl.uSurfaceColor,r.surfaceColor[0],r.surfaceColor[1],r.surfaceColor[2],h),r.highlight){n.uniform3f(this.uEl.uHighlightColor,r.highlight.color[0],r.highlight.color[1],r.highlight.color[2]),n.uniform1f(this.uEl.uHighlightAngle,r.highlight.angle),n.uniform1f(this.uEl.uHighlightFalloff,r.highlight.falloff),n.uniform1f(this.uEl.uHighlightAlpha,m),n.uniform1f(this.uEl.uHighlightMode,r.highlight.mode);let t=Math.min(e.origW,e.origH)*this.dpr,i=Math.min(r.highlight.widthDp*this.dpr,t*.5),a=(r.highlight.blurRadiusDp??r.highlight.widthDp/2)*this.dpr;n.uniform1f(this.uEl.uHighlightStrokeWidth,Math.ceil(i)*2),n.uniform1f(this.uEl.uHighlightBlur,a)}else n.uniform1f(this.uEl.uHighlightAlpha,0),n.uniform1f(this.uEl.uHighlightMode,0),n.uniform1f(this.uEl.uHighlightStrokeWidth,0),n.uniform1f(this.uEl.uHighlightBlur,0);r.isSdfTexture&&this.sdfTexture?(n.activeTexture(n.TEXTURE2),n.bindTexture(n.TEXTURE_2D,this.sdfTexture),n.uniform1i(this.uEl.uSdfTexSampler,2),n.uniform1f(this.uEl.uUseSdfTexture,1),n.uniform2f(this.uEl.uSdfTexSize,this.sdfTextureSize[0],this.sdfTextureSize[1]),n.uniform1f(this.uEl.uSdfLightAngle,r.isSdfTexture.lightAngle),n.uniform1f(this.uEl.uRefractionHeight,r.isSdfTexture.refractionHeight*this.dpr)):n.uniform1f(this.uEl.uUseSdfTexture,0),r.useContinuousSdf&&this.continuousSdfTexture?(n.activeTexture(n.TEXTURE2),n.bindTexture(n.TEXTURE_2D,this.continuousSdfTexture),n.uniform1i(this.uEl.uContinuousSdf,2),n.uniform1f(this.uEl.uUseContinuousSdf,1),n.uniform2f(this.uEl.uContinuousSdfTexSize,this.continuousSdfTexSize[0],this.continuousSdfTexSize[1]),n.uniform2f(this.uEl.uContinuousSdfElementSize,e.origW*this.dpr,e.origH*this.dpr)):n.uniform1f(this.uEl.uUseContinuousSdf,0),n.uniform1f(this.uEl.uEnterAlpha,e.enterAlpha),n.uniform1f(this.uEl.uCornerStyle,this.cornerStyle),r.isMagnifier?(n.uniform1f(this.uEl.uUseMagnifier,1),n.uniform1f(this.uEl.uMagnifierZoom,r.isMagnifier.zoom),n.uniform1f(this.uEl.uMagnifierOffsetY,r.isMagnifier.sampleOffsetY*this.dpr)):n.uniform1f(this.uEl.uUseMagnifier,0),n.uniform1f(this.uEl.uSkipColorControls,r.backdropFbo&&r.useSeparableBlur&&r.blurRadius>=.5?1:0),n.drawArrays(n.TRIANGLES,0,6),e.elHighlightAlpha=m}};function Ge(e,t,n,r){if(r){let r=document.createElement(`canvas`);return r.width=1,r.height=1,pe(r.getContext(`2d`),e,t,n)}let i=new Path2D;if(typeof i.roundRect==`function`)i.roundRect(0,0,e,t,n);else{let r=Math.min(n,e/2,t/2);i.moveTo(r,0),i.lineTo(e-r,0),i.arcTo(e,0,e,r,r),i.lineTo(e,t-r),i.arcTo(e,t,e-r,t,r),i.lineTo(r,t),i.arcTo(0,t,0,t-r,r),i.lineTo(0,r),i.arcTo(0,0,r,0,r),i.closePath()}return i}function Ke(e,t){let n=document.createElement(`canvas`);return n.width=e,n.height=t,{canvas:n,ctx:n.getContext(`2d`,{alpha:!0,willReadFrequently:!0})}}function qe(e){let{w:t,h:n,radius:r,offsetX:i,offsetY:a,blurSigma:o,margin:s,useG2:c,supersample:l}=e,u=Math.max(1,Math.ceil(t+2*s)),d=Math.max(1,Math.ceil(n+2*s)),f=u*l,p=d*l,{canvas:m,ctx:h}=Ke(f,p),{canvas:g,ctx:_}=Ke(f,p);h.save(),h.scale(l,l),h.translate(s,s);let v=Ge(t,n,r,c);return h.clip(v),h.globalCompositeOperation=`source-over`,h.fillStyle=`white`,h.fill(v),h.globalCompositeOperation=`destination-out`,h.save(),h.translate(i,a),h.fill(v),h.restore(),h.globalCompositeOperation=`source-over`,h.restore(),_.filter=o>.01?`blur(${o*l}px)`:`none`,_.drawImage(m,0,0),_.filter=`none`,{canvas:g,maskW:u,maskH:d,margin:s}}var Je={gooseGlassPost(e){let t=this.gl,{el:n,st:r,isButton:i,p:a,sx:o,sy:s,sw:c,sh:l,radii:u,togglePressProgress:d,elHighlightAlpha:f}=e,p=e.origW*this.dpr,m=e.origH*this.dpr,h=e.origCornerRadius*this.dpr,g=e.layerScaleX,_=e.layerScaleY;n.innerShadow&&((r,i)=>{let a=n.isToggleKnob||n.isBottomTabIndicator?d:1,f=r.alpha*a*e.enterAlpha,v=r.radius*a,y=r.offsetX*a,b=r.offsetY*a;if(f<=.001||v<=.5)return;let x=v*this.dpr,S=Math.ceil(x*3)+2,C=Math.max(1,Math.ceil(p+2*S)),w=Math.max(1,Math.ceil(m+2*S)),T=window.devicePixelRatio||1,E=Math.min(2,Math.max(1,Math.floor(T/this.dpr))),D=!!n.useContinuousSdf,O=y*this.dpr,k=b*this.dpr,A={w:p,h:m,radius:h,offsetX:O,offsetY:k,blurSigma:x,margin:S,useG2:D,supersample:E},j=ie(i,A),M=ae(this.innerShadowMaskCache,t,j,C,w);if(!M.ready){let e=qe(A);oe(t,M,e)}t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.useProgram(this.innerShadowMaskCompositeProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocIs),t.vertexAttribPointer(this.aPosLocIs,2,t.FLOAT,!1,0,0),t.uniform2f(this.uIs.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uIs.uOffset,o*this.dpr,s*this.dpr),t.uniform2f(this.uIs.uSize,c*this.dpr,l*this.dpr),t.uniform4f(this.uIs.uCornerRadii,u[0]*this.dpr,u[1]*this.dpr,u[2]*this.dpr,u[3]*this.dpr),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,M.tex),t.uniform1i(this.uIs.uInnerShadowMask,0),t.uniform2f(this.uIs.uMaskOffset,S,S),t.uniform2f(this.uIs.uMaskSize,M.w,M.h);let N=r.color??[0,0,0];t.uniform3f(this.uIs.uInnerShadowColor,N[0],N[1],N[2]),t.uniform1f(this.uIs.uInnerShadowAlpha,f),t.uniform2f(this.uIs.uOriginalSize,p,m),t.uniform1f(this.uIs.uOriginalCornerRadius,h),t.uniform2f(this.uIs.uLayerScale,g,_),t.uniform1f(this.uIs.uElementRotation,e.elementRotation),t.drawArrays(t.TRIANGLES,0,6)})(n.innerShadow,0);let v=!!n.isBottomTabContainer,y=i?a:v?d:0;if(i&&n.isInteractive&&r&&a>.001||v&&d>.001){t.useProgram(this.tintProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocTn),t.vertexAttribPointer(this.aPosLocTn,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE),t.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uTn.uOffset,o*this.dpr,s*this.dpr),t.uniform2f(this.uTn.uSize,c*this.dpr,l*this.dpr),t.uniform4f(this.uTn.uCornerRadii,u[0]*this.dpr,u[1]*this.dpr,u[2]*this.dpr,u[3]*this.dpr),t.uniform2f(this.uTn.uOriginalSize,p,m),t.uniform1f(this.uTn.uOriginalCornerRadius,h),t.uniform2f(this.uTn.uLayerScale,g,_),t.uniform1f(this.uTn.uElementRotation,e.elementRotation),t.uniform1f(this.uTn.uCornerStyle,this.cornerStyle),t.uniform4f(this.uTn.uColor,1,1,1,.08*y),t.drawArrays(t.TRIANGLES,0,6),t.useProgram(this.highlightProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocHl),t.vertexAttribPointer(this.aPosLocHl,2,t.FLOAT,!1,0,0),t.blendFunc(t.ONE,t.ONE),t.uniform2f(this.uHl.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uHl.uOffset,o*this.dpr,s*this.dpr),t.uniform2f(this.uHl.uSize,c*this.dpr,l*this.dpr),t.uniform4f(this.uHl.uCornerRadii,u[0]*this.dpr,u[1]*this.dpr,u[2]*this.dpr,u[3]*this.dpr),t.uniform2f(this.uHl.uOriginalSize,p,m),t.uniform1f(this.uHl.uOriginalCornerRadius,h),t.uniform2f(this.uHl.uLayerScale,g,_),t.uniform1f(this.uHl.uElementRotation,e.elementRotation),t.uniform1f(this.uHl.uCornerStyle,this.cornerStyle),t.uniform4f(this.uHl.uColor,1,1,1,.15*y);let i=Math.min(c,l)*this.dpr;t.uniform1f(this.uHl.uRadius,i*1.5);let a,d;if(v){let e=this.toggleStates.get(n.isBottomTabContainer.groupId),t=n.isBottomTabContainer.tabsCount??4,r=n.rect.w/t,i=((e?e.fraction:0)+.5)*r,o=c/n.rect.w;a=Math.max(0,Math.min(c,i*o))*this.dpr,d=l/2*this.dpr}else a=Math.max(0,Math.min(c,r.dragX*e.layerScaleX))*this.dpr,d=Math.max(0,Math.min(l,r.dragY*e.layerScaleY))*this.dpr;t.uniform2f(this.uHl.uPosition,a,d),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA)}if(n.isToggleKnob&&d<.999){let n=1*(1-d);t.useProgram(this.tintProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocTn),t.vertexAttribPointer(this.aPosLocTn,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uTn.uOffset,o*this.dpr,s*this.dpr),t.uniform2f(this.uTn.uSize,c*this.dpr,l*this.dpr),t.uniform4f(this.uTn.uCornerRadii,u[0]*this.dpr,u[1]*this.dpr,u[2]*this.dpr,u[3]*this.dpr),t.uniform2f(this.uTn.uOriginalSize,p,m),t.uniform1f(this.uTn.uOriginalCornerRadius,h),t.uniform2f(this.uTn.uLayerScale,g,_),t.uniform1f(this.uTn.uElementRotation,e.elementRotation),t.uniform1f(this.uTn.uCornerStyle,this.cornerStyle),t.uniform4f(this.uTn.uColor,1,1,1,n),t.drawArrays(t.TRIANGLES,0,6)}if(n.isBottomTabIndicator&&n.isBottomTabIndicator.dimColor){let r=n.isBottomTabIndicator.dimColor,i=d;t.useProgram(this.tintProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocTn),t.vertexAttribPointer(this.aPosLocTn,2,t.FLOAT,!1,0,0),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA),t.uniform2f(this.uTn.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uTn.uOffset,o*this.dpr,s*this.dpr),t.uniform2f(this.uTn.uSize,c*this.dpr,l*this.dpr),t.uniform4f(this.uTn.uCornerRadii,u[0]*this.dpr,u[1]*this.dpr,u[2]*this.dpr,u[3]*this.dpr),t.uniform2f(this.uTn.uOriginalSize,p,m),t.uniform1f(this.uTn.uOriginalCornerRadius,h),t.uniform2f(this.uTn.uLayerScale,g,_),t.uniform1f(this.uTn.uElementRotation,e.elementRotation),t.uniform1f(this.uTn.uCornerStyle,this.cornerStyle),t.uniform4f(this.uTn.uColor,r[0],r[1],r[2],.1*(1-i)),t.drawArrays(t.TRIANGLES,0,6),t.uniform4f(this.uTn.uColor,0,0,0,.03*i),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA)}if(i&&(n.label||n.icon)){let r=this.fgTextures.get(n.id);r&&(t.useProgram(this.foregroundProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocFg),t.vertexAttribPointer(this.aPosLocFg,2,t.FLOAT,!1,0,0),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,r),t.uniform1i(this.uFg.uTexture,0),t.uniform2f(this.uFg.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uFg.uOffset,o*this.dpr,s*this.dpr),t.uniform2f(this.uFg.uSize,c*this.dpr,l*this.dpr),t.uniform4f(this.uFg.uCornerRadii,u[0]*this.dpr,u[1]*this.dpr,u[2]*this.dpr,u[3]*this.dpr),t.uniform2f(this.uFg.uOriginalSize,p,m),t.uniform1f(this.uFg.uOriginalCornerRadius,h),t.uniform2f(this.uFg.uLayerScale,g,_),t.uniform1f(this.uFg.uCornerStyle,this.cornerStyle),n.useContinuousSdf&&this.continuousSdfTexture?(t.activeTexture(t.TEXTURE2),t.bindTexture(t.TEXTURE_2D,this.continuousSdfTexture),t.uniform1i(this.uFg.uContinuousSdf,2),t.uniform1f(this.uFg.uUseContinuousSdf,1),t.uniform2f(this.uFg.uContinuousSdfTexSize,this.continuousSdfTexSize[0],this.continuousSdfTexSize[1]),t.uniform2f(this.uFg.uContinuousSdfElementSize,e.origW*this.dpr,e.origH*this.dpr)):t.uniform1f(this.uFg.uUseContinuousSdf,0),t.uniform1f(this.uFg.uAlpha,1-.15*a),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA))}if(n.highlight&&n.highlight.alpha>.001){let r=(n.isToggleKnob||n.isBottomTabIndicator?f:n.highlight.alpha)*e.enterAlpha;if(r>.001){let i=Math.min(n.highlight.widthDp*this.dpr,Math.min(p,m)*.5),a=Math.max(1,Math.ceil(i)*2),d=Math.max(0,(n.highlight.blurRadiusDp??n.highlight.widthDp/2)*this.dpr),f=Math.ceil(a)+4,v=Math.max(1,Math.ceil(p+2*f)),y=Math.max(1,Math.ceil(m+2*f)),b=!!n.useContinuousSdf,x=[b?`g2`:`rr`,p.toFixed(3),m.toFixed(3),h.toFixed(3),a,d.toFixed(3),f,v,y].join(`:`),S=this.strokeMaskCache.get(x);if(!S){let e=document.createElement(`canvas`);e.width=v,e.height=y;let n=e.getContext(`2d`,{alpha:!0,willReadFrequently:!0});if(!n)throw Error(`2D canvas not supported`);let r=t.createTexture();if(!r)throw Error(`WebGL texture allocation failed`);if(S={tex:r,canvas:e,ctx:n,w:v,h:y,ready:!1},this.strokeMaskCache.set(x,S),this.strokeMaskCache.size>32){let e=this.strokeMaskCache.keys().next().value;if(e&&e!==x){let n=this.strokeMaskCache.get(e);n&&t.deleteTexture(n.tex),this.strokeMaskCache.delete(e)}}}if(!S.ready){let e=S.ctx;e.clearRect(0,0,S.w,S.h),e.save(),e.translate(f,f);let n;if(b)n=pe(e,p,m,h);else{n=new Path2D;let e=Math.min(h,p/2,m/2);n.moveTo(e,0),n.lineTo(p-e,0),n.arcTo(p,0,p,e,e),n.lineTo(p,m-e),n.arcTo(p,m,p-e,m,e),n.lineTo(e,m),n.arcTo(0,m,0,m-e,e),n.lineTo(0,e),n.arcTo(0,0,e,0,e),n.closePath()}e.clip(n),e.lineWidth=a,e.strokeStyle=`rgba(255,255,255,1)`,e.lineJoin=`round`,e.lineCap=`round`,e.filter=d>.01?`blur(${d}px)`:`none`,e.stroke(n),e.filter=`none`,e.restore(),t.bindTexture(t.TEXTURE_2D,S.tex),t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),L(t,S.canvas),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),S.ready=!0}t.enable(t.BLEND),n.highlight.mode===1?t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA):t.blendFunc(t.ONE,t.ONE),t.useProgram(this.strokeMaskCompositeProgram),t.bindBuffer(t.ARRAY_BUFFER,this.quadBuffer),t.enableVertexAttribArray(this.aPosLocSm),t.vertexAttribPointer(this.aPosLocSm,2,t.FLOAT,!1,0,0),t.uniform2f(this.uSm.uCanvasSize,this.canvas.width,this.canvas.height),t.uniform2f(this.uSm.uOffset,o*this.dpr,s*this.dpr),t.uniform2f(this.uSm.uSize,c*this.dpr,l*this.dpr),t.uniform4f(this.uSm.uCornerRadii,u[0]*this.dpr,u[1]*this.dpr,u[2]*this.dpr,u[3]*this.dpr),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,S.tex),t.uniform1i(this.uSm.uStrokeMask,0),t.uniform2f(this.uSm.uMaskOffset,f,f),t.uniform2f(this.uSm.uMaskSize,S.w,S.h),t.uniform4f(this.uSm.uHighlightColor,n.highlight.color[0],n.highlight.color[1],n.highlight.color[2],1),t.uniform1f(this.uSm.uHighlightAngle,n.useGravityAngle?this.gravityAngle:n.highlight.angle),t.uniform1f(this.uSm.uHighlightFalloff,n.highlight.falloff),t.uniform1f(this.uSm.uHighlightAlpha,r),t.uniform1f(this.uSm.uHighlightMode,n.highlight.mode),t.uniform2f(this.uSm.uOriginalSize,p,m),t.uniform1f(this.uSm.uOriginalCornerRadius,h),t.uniform2f(this.uSm.uLayerScale,g,_),t.uniform1f(this.uSm.uElementRotation,e.elementRotation),t.drawArrays(t.TRIANGLES,0,6),t.blendFunc(t.SRC_ALPHA,t.ONE_MINUS_SRC_ALPHA)}}}},W=class{constructor(e,{transparentBackdrop:t=!1}={}){n(this,`gl`),n(this,`transparentBackdrop`,!1),n(this,`transparentFrameReady`,!1),n(this,`transparentNeutralColor`,null),n(this,`transparentBackdropProgram`,null),n(this,`aPosLocTb`),n(this,`uTb`,{}),n(this,`elementProgram`),n(this,`shadowProgram`),n(this,`wallpaperProgram`),n(this,`foregroundProgram`),n(this,`highlightProgram`),n(this,`tintProgram`),n(this,`rimHighlightProgram`),n(this,`highlightStrokeProgram`),n(this,`highlightCompositeProgram`),n(this,`strokeMaskCompositeProgram`),n(this,`innerShadowMaskCompositeProgram`),n(this,`plainRectProgram`),n(this,`progressiveBlurProgram`),n(this,`copyProgram`),n(this,`solidFillProgram`),n(this,`colorControlsProgram`),n(this,`sceneTintProgram`),n(this,`quadBuffer`),n(this,`wallpaperTexture`,null),n(this,`wallpaperReady`,!1),n(this,`wallpaperSize`,[1,1]),n(this,`canvas`),n(this,`dpr`,0),n(this,`buttonConfigs`,[]),n(this,`buttonStates`,new Map),n(this,`toggleStates`,new Map),n(this,`scrollY`,0),n(this,`scrollVelocity`,0),n(this,`contentHeight`,0),n(this,`cssWidth`,0),n(this,`cssHeight`,0),n(this,`wheelTarget`,null),n(this,`backgroundColor`,null),n(this,`needsRedraw`,!0),n(this,`fboA`,null),n(this,`fboATex`,null),n(this,`fboB`,null),n(this,`fboBTex`,null),n(this,`fboW`,0),n(this,`fboH`,0),n(this,`tabsBackdropFbo`,null),n(this,`tabsBackdropTex`,null),n(this,`tabsBackdropDirty`,!0),n(this,`gpElementFbo`,null),n(this,`gpElementTex`,null),n(this,`blurFboA`,null),n(this,`blurFboATex`,null),n(this,`blurFboB`,null),n(this,`blurFboBTex`,null),n(this,`highlightMaskFbo`,null),n(this,`highlightMaskTex`,null),n(this,`dialogBackdropFbo`,null),n(this,`dialogBackdropTex`,null),n(this,`dialogBackdropKey`,null),n(this,`blurPrograms`,new Map),n(this,`highlightBlurPrograms`,new Map),n(this,`gravityAngle`,45*Math.PI/180),n(this,`blurTapCap`,17),n(this,`blurDownsample`,1),n(this,`cornerStyle`,1),n(this,`sdfTexture`,null),n(this,`sdfTextureReady`,!1),n(this,`sdfTextureSize`,[1,1]),n(this,`continuousSdfPool`,new Map),n(this,`continuousSdfTexture`,null),n(this,`continuousSdfTexSize`,[256,256]),n(this,`continuousSdfKey`,null),n(this,`fgCanvas`),n(this,`fgCtx`),n(this,`fgTextures`,new Map),n(this,`fgDirtyIds`,new Set),n(this,`strokeMaskCache`,new Map),n(this,`innerShadowMaskCache`,new Map),n(this,`rafId`,null),n(this,`animRafId`,null),n(this,`aPosLocEl`),n(this,`aPosLocSh`),n(this,`aPosLocWp`),n(this,`aPosLocFg`),n(this,`aPosLocHl`),n(this,`aPosLocTn`),n(this,`aPosLocRm`),n(this,`aPosLocHs`),n(this,`aPosLocHc`),n(this,`aPosLocSm`),n(this,`aPosLocIs`),n(this,`aPosLocPr`),n(this,`aPosLocPb`),n(this,`aPosLocCp`),n(this,`aPosLocSf`),n(this,`aPosLocCc`),n(this,`aPosLocSt`),n(this,`uEl`,{}),n(this,`uSh`,{}),n(this,`uWp`,{}),n(this,`uFg`,{}),n(this,`uHl`,{}),n(this,`uTn`,{}),n(this,`uRm`,{}),n(this,`uHs`,{}),n(this,`uHc`,{}),n(this,`uSm`,{}),n(this,`uIs`,{}),n(this,`uPr`,{}),n(this,`uPb`,{}),n(this,`uCp`,{}),n(this,`uSf`,{}),n(this,`uCc`,{}),n(this,`uSt`,{}),this.canvas=e,this.transparentBackdrop=t;let r=e.getContext(`webgl`,{premultipliedAlpha:!1,alpha:t,antialias:!0,preserveDrawingBuffer:!1});if(!r)throw Error(`WebGL not supported`);if(t&&!r.getContextAttributes()?.alpha)throw r.getExtension(`WEBGL_lose_context`)?.loseContext(),Error(`Transparent WebGL canvas not supported`);if(this.gl=r,r.getExtension(`OES_standard_derivatives`),this.elementProgram=z(r,b,d),this.shadowProgram=z(r,b,f),this.wallpaperProgram=z(r,b,x),this.foregroundProgram=z(r,b,D),this.highlightProgram=z(r,b,p),this.tintProgram=z(r,b,m),this.rimHighlightProgram=z(r,b,h),this.highlightStrokeProgram=z(r,b,g),this.highlightCompositeProgram=z(r,b,_),this.strokeMaskCompositeProgram=z(r,b,v),this.innerShadowMaskCompositeProgram=z(r,b,y),this.plainRectProgram=z(r,b,O),this.progressiveBlurProgram=z(r,b,k),this.copyProgram=z(r,b,S),t){this.transparentBackdropProgram=z(r,b,C),this.aPosLocTb=r.getAttribLocation(this.transparentBackdropProgram,`aPos`);for(let e of[`uTexture`,`uCanvasSize`,`uNeutralColor`,`uGlassRect`,`uIndicatorRect`,`uGlassAlpha`,`uIndicatorAlpha`])this.uTb[e]=r.getUniformLocation(this.transparentBackdropProgram,e)}this.solidFillProgram=z(r,b,w),this.colorControlsProgram=z(r,b,T),this.sceneTintProgram=z(r,b,E),this.quadBuffer=r.createBuffer(),r.bindBuffer(r.ARRAY_BUFFER,this.quadBuffer),r.bufferData(r.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),r.STATIC_DRAW),this.aPosLocEl=r.getAttribLocation(this.elementProgram,`aPos`),this.aPosLocSh=r.getAttribLocation(this.shadowProgram,`aPos`),this.aPosLocWp=r.getAttribLocation(this.wallpaperProgram,`aPos`),this.aPosLocFg=r.getAttribLocation(this.foregroundProgram,`aPos`),this.aPosLocHl=r.getAttribLocation(this.highlightProgram,`aPos`),this.aPosLocTn=r.getAttribLocation(this.tintProgram,`aPos`),this.aPosLocRm=r.getAttribLocation(this.rimHighlightProgram,`aPos`),this.aPosLocHs=r.getAttribLocation(this.highlightStrokeProgram,`aPos`),this.aPosLocHc=r.getAttribLocation(this.highlightCompositeProgram,`aPos`),this.aPosLocSm=r.getAttribLocation(this.strokeMaskCompositeProgram,`aPos`),this.aPosLocIs=r.getAttribLocation(this.innerShadowMaskCompositeProgram,`aPos`),this.aPosLocPr=r.getAttribLocation(this.plainRectProgram,`aPos`),this.aPosLocPb=r.getAttribLocation(this.progressiveBlurProgram,`aPos`),this.aPosLocCp=r.getAttribLocation(this.copyProgram,`aPos`),this.aPosLocSf=r.getAttribLocation(this.solidFillProgram,`aPos`),this.aPosLocCc=r.getAttribLocation(this.colorControlsProgram,`aPos`),this.aPosLocSt=r.getAttribLocation(this.sceneTintProgram,`aPos`),this.fgCanvas=typeof document<`u`?document.createElement(`canvas`):null;let i=this.fgCanvas?.getContext(`2d`,{alpha:!0,willReadFrequently:!0});if(!i)throw Error(`2D canvas not supported`);this.fgCtx=i,this.gooseUniforms()}gooseUniforms(){let e=this.gl;for(let t of`uBackdrop.uWallpaperSampler.uTabsBackdropSampler.uCanvasSize.uWallpaperSize.uElementOffset.uElementSize.uCornerRadii.uRefractionHeight.uRefractionAmount.uDepthEffect.uChromaticAberration.uBlurRadius.uSaturation.uBrightness.uContrast.uTintColor.uSurfaceColor.uHighlightColor.uHighlightAngle.uHighlightFalloff.uHighlightAlpha.uHighlightMode.uHighlightStrokeWidth.uHighlightBlur.uInnerShadowRadius.uInnerShadowAlpha.uInnerShadowOffset.uContentScaleX.uContentScaleY.uUseToggleBackdrop.uUseSolidBackdrop.uSolidBackdropColor.uTrackColor.uTrackRect.uTrackCornerRadius.uOriginalSize.uOriginalCornerRadius.uLayerScale.uIndicatorBackdrop.uContainerRect.uContainerCornerRadius.uIndicatorAccent.uInsetPx.uIndicatorPressProgress.uIndicatorPanelOffset.uDpr.uContainerCenter.uContainerScale.uTabContentTex0.uTabContentTex1.uTabContentTex2.uTabContentTex3.uTabContentTex4.uTabContentTex5.uTabContentTex6.uTabContentTex7.uTabContentRects[0].uTabContentRects[1].uTabContentRects[2].uTabContentRects[3].uTabContentRects[4].uTabContentRects[5].uTabContentRects[6].uTabContentRects[7].uTabContentCount.uTabsGlassLayer.uSdfTexSampler.uUseSdfTexture.uSdfTexSize.uSdfLightAngle.uEnterAlpha.uCornerStyle.uSkipColorControls.uUseMagnifier.uMagnifierZoom.uMagnifierOffsetY.uElementRotation.uContinuousSdf.uUseContinuousSdf.uContinuousSdfTexSize.uContinuousSdfElementSize`.split(`.`))this.uEl[t]=e.getUniformLocation(this.elementProgram,t);for(let t of[`uCanvasSize`,`uElementOffset`,`uElementSize`,`uCornerRadii`,`uShadowRadius`,`uShadowOffset`,`uShadowColor`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`,`uCornerStyle`])this.uSh[t]=e.getUniformLocation(this.shadowProgram,t);for(let t of[`uBackdrop`,`uCanvasSize`,`uWallpaperSize`])this.uWp[t]=e.getUniformLocation(this.wallpaperProgram,t);for(let t of[`uTexture`,`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uAlpha`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uCornerStyle`,`uUseContinuousSdf`,`uContinuousSdf`,`uContinuousSdfTexSize`,`uContinuousSdfElementSize`])this.uFg[t]=e.getUniformLocation(this.foregroundProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uColor`,`uRadius`,`uPosition`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`,`uCornerStyle`])this.uHl[t]=e.getUniformLocation(this.highlightProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uColor`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`,`uCornerStyle`])this.uTn[t]=e.getUniformLocation(this.tintProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uHighlightColor`,`uHighlightAngle`,`uHighlightFalloff`,`uHighlightAlpha`,`uHighlightMode`,`uHighlightStrokeWidth`,`uHighlightBlur`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`,`uCornerStyle`,`uUseContinuousSdf`,`uContinuousSdf`,`uContinuousSdfTexSize`,`uContinuousSdfElementSize`])this.uRm[t]=e.getUniformLocation(this.rimHighlightProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uHighlightStrokeWidth`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`,`uCornerStyle`,`uUseContinuousSdf`,`uContinuousSdf`,`uContinuousSdfTexSize`,`uContinuousSdfElementSize`])this.uHs[t]=e.getUniformLocation(this.highlightStrokeProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uBlurredMask`,`uMaskTexSize`,`uHighlightColor`,`uHighlightAngle`,`uHighlightFalloff`,`uHighlightAlpha`,`uHighlightMode`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`,`uCornerStyle`,`uUseContinuousSdf`,`uContinuousSdf`,`uContinuousSdfTexSize`,`uContinuousSdfElementSize`])this.uHc[t]=e.getUniformLocation(this.highlightCompositeProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uStrokeMask`,`uMaskOffset`,`uMaskSize`,`uHighlightColor`,`uHighlightAngle`,`uHighlightFalloff`,`uHighlightAlpha`,`uHighlightMode`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`])this.uSm[t]=e.getUniformLocation(this.strokeMaskCompositeProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uInnerShadowMask`,`uMaskOffset`,`uMaskSize`,`uInnerShadowColor`,`uInnerShadowAlpha`,`uOriginalSize`,`uOriginalCornerRadius`,`uLayerScale`,`uElementRotation`])this.uIs[t]=e.getUniformLocation(this.innerShadowMaskCompositeProgram,t);for(let t of[`uCanvasSize`,`uOffset`,`uSize`,`uCornerRadii`,`uColor`,`uCornerStyle`,`uUseContinuousSdf`,`uContinuousSdf`,`uContinuousSdfTexSize`,`uContinuousSdfElementSize`])this.uPr[t]=e.getUniformLocation(this.plainRectProgram,t);for(let t of[`uBackdrop`,`uCanvasSize`,`uWallpaperSize`,`uOffset`,`uSize`,`uBlurRadius`,`uTintColor`,`uTintIntensity`])this.uPb[t]=e.getUniformLocation(this.progressiveBlurProgram,t);for(let t of[`uTexture`,`uCanvasSize`])this.uCp[t]=e.getUniformLocation(this.copyProgram,t);for(let t of[`uColor`])this.uSf[t]=e.getUniformLocation(this.solidFillProgram,t);for(let t of[`uTexture`,`uTexSize`,`uBrightness`,`uContrast`,`uSaturation`])this.uCc[t]=e.getUniformLocation(this.colorControlsProgram,t);for(let t of[`uTexture`,`uCanvasSize`,`uTintColor`])this.uSt[t]=e.getUniformLocation(this.sceneTintProgram,t)}gooseBlurProg(e){if(this.blurPrograms.has(e))return;let t=this.gl,n=R(t,t.FRAGMENT_SHADER,N(e,`horizontal`)),r=R(t,t.FRAGMENT_SHADER,N(e,`vertical`)),i=n=>{let r=R(t,t.VERTEX_SHADER,b),i=t.createProgram();if(t.attachShader(i,r),t.attachShader(i,n),t.bindAttribLocation(i,0,`aPos`),t.linkProgram(i),t.deleteShader(r),t.deleteShader(n),!t.getProgramParameter(i,t.LINK_STATUS)){let n=t.getProgramInfoLog(i);throw t.deleteProgram(i),Error(`Blur program link error (taps=`+e+`): `+n)}return i},a=i(n),o=i(r),s={uTexture:t.getUniformLocation(a,`uTexture`),uTexSize:t.getUniformLocation(a,`uTexSize`),uRadius:t.getUniformLocation(a,`uRadius`)},c={uTexture:t.getUniformLocation(o,`uTexture`),uTexSize:t.getUniformLocation(o,`uTexSize`),uRadius:t.getUniformLocation(o,`uRadius`)};this.blurPrograms.set(e,{hProg:a,vProg:o,uH:s,uV:c,aPosH:0,aPosV:0})}gooseBlur(e,t){let n=this.gl,r=this.fboW,i=this.fboH,a=P(t);a=Math.min(a,Math.max(1,this.blurTapCap|0)),this.gooseBlurProg(a);let o=this.blurPrograms.get(a),s=n.getParameter(n.FRAMEBUFFER_BINDING);return n.disable(n.BLEND),n.bindFramebuffer(n.FRAMEBUFFER,this.blurFboA),n.viewport(0,0,r,i),n.useProgram(o.hProg),n.bindBuffer(n.ARRAY_BUFFER,this.quadBuffer),n.enableVertexAttribArray(o.aPosH),n.vertexAttribPointer(o.aPosH,2,n.FLOAT,!1,0,0),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,e),n.uniform1i(o.uH.uTexture,0),n.uniform2f(o.uH.uTexSize,r,i),n.uniform1f(o.uH.uRadius,t),n.drawArrays(n.TRIANGLES,0,6),n.bindFramebuffer(n.FRAMEBUFFER,this.blurFboB),n.viewport(0,0,r,i),n.useProgram(o.vProg),n.bindBuffer(n.ARRAY_BUFFER,this.quadBuffer),n.enableVertexAttribArray(o.aPosV),n.vertexAttribPointer(o.aPosV,2,n.FLOAT,!1,0,0),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.blurFboATex),n.uniform1i(o.uV.uTexture,0),n.uniform2f(o.uV.uTexSize,r,i),n.uniform1f(o.uV.uRadius,t),n.drawArrays(n.TRIANGLES,0,6),n.bindFramebuffer(n.FRAMEBUFFER,s),n.viewport(0,0,r,i),this.blurFboBTex}gooseHLBlurProg(e){if(this.highlightBlurPrograms.has(e))return;let t=this.gl,n=R(t,t.FRAGMENT_SHADER,I(e,`horizontal`)),r=R(t,t.FRAGMENT_SHADER,I(e,`vertical`)),i=n=>{let r=R(t,t.VERTEX_SHADER,b),i=t.createProgram();if(t.attachShader(i,r),t.attachShader(i,n),t.bindAttribLocation(i,0,`aPos`),t.linkProgram(i),t.deleteShader(r),t.deleteShader(n),!t.getProgramParameter(i,t.LINK_STATUS)){let n=t.getProgramInfoLog(i);throw t.deleteProgram(i),Error(`Highlight blur program link error (taps=`+e+`): `+n)}return i},a=i(n),o=i(r),s={uTexture:t.getUniformLocation(a,`uTexture`),uTexSize:t.getUniformLocation(a,`uTexSize`),uRadius:t.getUniformLocation(a,`uRadius`)},c={uTexture:t.getUniformLocation(o,`uTexture`),uTexSize:t.getUniformLocation(o,`uTexSize`),uRadius:t.getUniformLocation(o,`uRadius`)};this.highlightBlurPrograms.set(e,{hProg:a,vProg:o,uH:s,uV:c,aPosH:0,aPosV:0})}gooseHLBlur(e,t){let n=this.gl,r=this.fboW,i=this.fboH,a=ee(t);a=Math.min(a,Math.max(3,this.blurTapCap|0)),this.gooseHLBlurProg(a);let o=this.highlightBlurPrograms.get(a),s=n.getParameter(n.FRAMEBUFFER_BINDING);return n.disable(n.BLEND),n.bindFramebuffer(n.FRAMEBUFFER,this.blurFboA),n.viewport(0,0,r,i),n.useProgram(o.hProg),n.bindBuffer(n.ARRAY_BUFFER,this.quadBuffer),n.enableVertexAttribArray(o.aPosH),n.vertexAttribPointer(o.aPosH,2,n.FLOAT,!1,0,0),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,e),n.uniform1i(o.uH.uTexture,0),n.uniform2f(o.uH.uTexSize,r,i),n.uniform1f(o.uH.uRadius,t),n.drawArrays(n.TRIANGLES,0,6),n.bindFramebuffer(n.FRAMEBUFFER,this.blurFboB),n.viewport(0,0,r,i),n.useProgram(o.vProg),n.bindBuffer(n.ARRAY_BUFFER,this.quadBuffer),n.enableVertexAttribArray(o.aPosV),n.vertexAttribPointer(o.aPosV,2,n.FLOAT,!1,0,0),n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.blurFboATex),n.uniform1i(o.uV.uTexture,0),n.uniform2f(o.uV.uTexSize,r,i),n.uniform1f(o.uV.uRadius,t),n.drawArrays(n.TRIANGLES,0,6),n.bindFramebuffer(n.FRAMEBUFFER,s),n.viewport(0,0,r,i),this.blurFboBTex}gooseKill(){this.rafId!==null&&cancelAnimationFrame(this.rafId),this.rafId=null,this.animRafId!==null&&cancelAnimationFrame(this.animRafId),this.animRafId=null;let e=this.gl;this.wallpaperTexture&&e.deleteTexture(this.wallpaperTexture);for(let t of this.fgTextures.values())e.deleteTexture(t);this.fgTextures.clear();for(let t of this.strokeMaskCache.values())e.deleteTexture(t.tex);this.strokeMaskCache.clear(),se(e,this.innerShadowMaskCache),this.fboA&&e.deleteFramebuffer(this.fboA),this.fboATex&&e.deleteTexture(this.fboATex),this.fboB&&e.deleteFramebuffer(this.fboB),this.fboBTex&&e.deleteTexture(this.fboBTex),this.fboA=this.fboB=null,this.fboATex=this.fboBTex=null,this.tabsBackdropFbo&&e.deleteFramebuffer(this.tabsBackdropFbo),this.tabsBackdropTex&&e.deleteTexture(this.tabsBackdropTex),this.tabsBackdropFbo=null,this.tabsBackdropTex=null,this.gpElementFbo&&e.deleteFramebuffer(this.gpElementFbo),this.gpElementTex&&e.deleteTexture(this.gpElementTex),this.blurFboA&&e.deleteFramebuffer(this.blurFboA),this.blurFboATex&&e.deleteTexture(this.blurFboATex),this.blurFboB&&e.deleteFramebuffer(this.blurFboB),this.blurFboBTex&&e.deleteTexture(this.blurFboBTex),this.gpElementFbo=this.blurFboA=this.blurFboB=null,this.gpElementTex=this.blurFboATex=this.blurFboBTex=null,this.highlightMaskFbo&&e.deleteFramebuffer(this.highlightMaskFbo),this.highlightMaskTex&&e.deleteTexture(this.highlightMaskTex),this.highlightMaskFbo=null,this.highlightMaskTex=null,this.dialogBackdropFbo&&e.deleteFramebuffer(this.dialogBackdropFbo),this.dialogBackdropTex&&e.deleteTexture(this.dialogBackdropTex),this.dialogBackdropFbo=null,this.dialogBackdropTex=null,this.dialogBackdropKey=null;for(let{hProg:t,vProg:n}of this.blurPrograms.values())e.deleteProgram(t),e.deleteProgram(n);this.blurPrograms.clear();for(let{hProg:t,vProg:n}of this.highlightBlurPrograms.values())e.deleteProgram(t),e.deleteProgram(n);this.highlightBlurPrograms.clear(),this.sdfTexture&&e.deleteTexture(this.sdfTexture),this.sdfTexture=null;for(let{tex:t}of this.continuousSdfPool.values())e.deleteTexture(t);this.continuousSdfPool.clear(),this.continuousSdfTexture=null,this.continuousSdfKey=null,e.deleteProgram(this.elementProgram),e.deleteProgram(this.shadowProgram),e.deleteProgram(this.wallpaperProgram),e.deleteProgram(this.foregroundProgram),e.deleteProgram(this.highlightProgram),e.deleteProgram(this.tintProgram),e.deleteProgram(this.rimHighlightProgram),e.deleteProgram(this.highlightStrokeProgram),e.deleteProgram(this.highlightCompositeProgram),e.deleteProgram(this.strokeMaskCompositeProgram),e.deleteProgram(this.innerShadowMaskCompositeProgram),e.deleteProgram(this.plainRectProgram),e.deleteProgram(this.progressiveBlurProgram),e.deleteProgram(this.copyProgram),this.transparentBackdropProgram&&e.deleteProgram(this.transparentBackdropProgram),e.deleteProgram(this.solidFillProgram),e.deleteProgram(this.colorControlsProgram),e.deleteProgram(this.sceneTintProgram),e.deleteBuffer(this.quadBuffer)}};n(W,`gooseTabScale`,78/56),Object.assign(W.prototype,ce,ge,_e,be,Re,ze,Be,Ve,He,Ue,We,Je);var G=1,Ye=new Set,Xe=48*G,Ze=16*G,Qe=15*G,$e=`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,et={refractionHeight:12*G,refractionAmount:-24*G,depthEffect:!1,chromaticAberration:!1,blurRadius:2*G,saturation:1.5,brightness:0,contrast:1},K={mode:0,color:[1,1,1],angle:45*Math.PI/180,falloff:1,alpha:1,widthDp:.5},tt={radius:24*G,alpha:.1,offsetX:0,offsetY:4*G,color:[0,0,0]},q={homeContentColor:[0,0,0,1],homeSubtitleColor:[0,136/255,1,1],homeTextHalo:`dark`,toggleAccent:[52/255,199/255,89/255],toggleTrackOff:[120/255,120/255,120/255,.2],toggleCardBg:[1,1,1,1],sliderAccent:[0,136/255,1],sliderTrackOff:[120/255,120/255,120/255,.2],sliderCardBg:[1,1,1,1],tabsContentColor:[0,0,0,1],tabsAccent:[0,136/255,1],tabsContainer:[250/255,250/255,250/255,.4],tabsTextHalo:`dark`,dialogContentColor:[0,0,0,1],dialogAccent:[0,136/255,1,1],dialogContainer:[250/255,250/255,250/255,.6],dialogDim:[41/255,41/255,58/255,.23],dialogBlurRadius:16*G,dialogBrightness:.2,magnifierContentColor:[0,0,0,1],magnifierAccent:[0,136/255,1,1],magnifierCardBg:[1,1,1,.9],controlCenterAccent:[0,136/255,1,1],progressiveContentColor:[0,0,0,1],progressiveTint:[1,1,1,1],progressiveTextHalo:`dark`,adaptiveContentColor:[0,0,0,1],backIconColor:[0,0,0,1],buttonSurface:[1,1,1,.3]},nt={homeContentColor:[1,1,1,1],homeSubtitleColor:[0,136/255,1,1],homeTextHalo:`light`,toggleAccent:[48/255,209/255,88/255],toggleTrackOff:[120/255,120/255,128/255,.36],toggleCardBg:[18/255,18/255,18/255,1],sliderAccent:[0,145/255,1],sliderTrackOff:[120/255,120/255,128/255,.36],sliderCardBg:[18/255,18/255,18/255,1],tabsContentColor:[1,1,1,1],tabsAccent:[0,145/255,1],tabsContainer:[18/255,18/255,18/255,.4],tabsTextHalo:`light`,dialogContentColor:[1,1,1,1],dialogAccent:[0,145/255,1,1],dialogContainer:[18/255,18/255,18/255,.4],dialogDim:[18/255,18/255,18/255,.56],dialogBlurRadius:8*G,dialogBrightness:0,magnifierContentColor:[1,1,1,1],magnifierAccent:[0,145/255,1,1],magnifierCardBg:[18/255,18/255,18/255,.9],controlCenterAccent:[0,145/255,1,1],progressiveContentColor:[1,1,1,1],progressiveTint:[128/255,128/255,128/255,1],progressiveTextHalo:`light`,adaptiveContentColor:[1,1,1,1],backIconColor:[1,1,1,1],buttonSurface:[18/255,18/255,18/255,.4]};function rt(e){return e?q:nt}var it=`Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,at=`M400 552 L147 653 q-24 10 -45.5 -4.5 T80 608 v-22 q0 -12 5.5 -23 t15.5 -18 l299 -209 v-176 q0 -33 23.5 -56.5 T480 80 q33 0 56.5 23.5 T560 160 v176 l299 209 q10 7 15.5 18 t5.5 23 v22 q0 26 -21.5 40.5 T813 653 L560 552 v144 l103 72 q8 6 12.5 14.5 T680 801 v24 q0 20 -16.5 32.5 T627 864 l-147 -44 l-147 44 q-20 6 -36.5 -6.5 T280 825 v-24 q0 -10 4.5 -18.5 T297 768 l103 -72 v-144 Z`,ot={toggleOn:!1,sliderValue:50,selectedTab:0,selectedTab2:0,magnifierX:0,magnifierY:0,globalSeparableBlur:!0,capsuleShape:!0,hideOverlayButtons:!1,ratingValue:0,ringProgressValue:50},st=null;function ct(e,t,n=400){return typeof document<`u`&&(st||=document.createElement(`canvas`).getContext(`2d`),st)?(st.font=`${n} ${t}px ${$e}`,st.measureText(e).width):e.length*t*.55}6*G,40*G,24*G,48*G;var lt=new Map;function ut(e){let{groupId:t,trackX:n,dragW:r,rendererRef:i,onValueChange:a,onLiveValue:o,getFraction:s,beginDrag:c,drag:l,endDrag:u,setTarget:d,count:f,snap:p,liveUpdate:m=!1,onTapJump:h=!0,didDragThreshold:g=3}=e;lt.has(t)||lt.set(t,{fraction:0,x:0,didDrag:!1});let _=lt.get(t),v=e=>Math.max(0,Math.min(1,(e-n)/r)),y=e=>p?p(e):e;return{onTap:e=>{if(!h)return;let n=y(v(e.x)),r=i?.current;r&&d(r,t,n,f),a(n)},onDragStart:e=>{let n=i?.current;n&&(Ye.add(t),_.fraction=s(n,t),_.x=e.x,_.didDrag=!1,c(n,t,_.fraction,f))},onDrag:e=>{let n=i?.current;if(!n)return;Math.abs(e.x-_.x)>g&&(_.didDrag=!0),l(n,t,_.fraction,e.x,_.x,r,f);let c=s(n,t);o&&o(c),m&&a(c)},onDragEnd:()=>{let e=i?.current;if(!e)return;let n=u(e,t,f),r=y(n);p&&f==null&&d(e,t,r,f),a(r),Ye.delete(t)}}}var dt={getFraction:(e,t)=>e.gooseTglFrac(t),beginDrag:(e,t,n)=>e.gooseTglDragStart(t,n),drag:(e,t,n,r,i,a)=>e.gooseTglDrag(t,n,r,i,a),endDrag:(e,t)=>e.gooseSldDragEnd(t),setTarget:(e,t,n)=>e.gooseTglTarget(t,n)},ft={getFraction:(e,t)=>e.gooseTglTargetGet(t),beginDrag:(e,t,n)=>e.gooseTglDragStart(t,n),drag:(e,t,n,r,i,a)=>e.gooseTglDrag(t,n,r,i,a),endDrag:(e,t)=>e.gooseTglDragEnd(t),setTarget:(e,t,n)=>e.gooseTglTarget(t,n)};function pt(e,t,n,r=!0){return{id:e,kind:`button`,rect:t,...et,cornerRadius:t.h/2,tintColor:n.tintColor,surfaceColor:n.surfaceColor,highlight:{...K},outerShadow:{...tt},label:n.label,labelColor:n.labelColor,labelFontSizePx:n.labelFontSizePx,showChevron:!1,isInteractive:!0,scroll:r}}function J(e,t,n,r={},i=!0){return{id:e,kind:`text`,rect:t,cornerRadius:0,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:``,labelColor:[0,0,0,1],showChevron:!1,isInteractive:!1,pressTintColor:r.pressTintColor,scroll:i,text:{content:n,color:r.color??[0,0,0,1],fontSizePx:r.fontSizePx??Qe,fontWeight:r.fontWeight??400,align:r.align??`left`,wrap:r.wrap??!1,paddingPx:r.paddingPx??16,valign:r.valign,maxLines:r.maxLines,halo:r.halo??`auto`,icon:r.icon}}}function Y(e,t,n,r=0,i=!0){return{id:e,kind:`plain-rect`,rect:t,cornerRadius:r,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:``,labelColor:[0,0,0,1],showChevron:!1,isInteractive:!1,scroll:i,plainRect:{color:n}}}function mt(e,t,n,r,i){lt.has(e)||lt.set(e,{fraction:0,x:0,didDrag:!1});let a=lt.get(e);return{onTap:()=>{},onDragStart:t=>{let r=i?.current;r&&(Ye.add(e),a.fraction=r.gooseTabTarget(e),a.x=t.x,a.didDrag=!1,r.gooseTabDragStart(e,a.fraction,n))},onDrag:r=>{let o=i?.current;o&&(Math.abs(r.x-a.x)>3&&(a.didDrag=!0),o.gooseTabDrag(e,a.fraction,r.x,a.x,t,n))},onDragEnd:()=>{let t=i?.current;if(!t)return;let o=t.gooseTabDragEnd(e,n);a.didDrag&&r(o),Ye.delete(e)}}}function X(e,t,n={},r=!0){return{id:e,kind:`glass-shape`,rect:t,cornerRadius:n.cornerRadius??t.h/2,refractionHeight:n.refractionHeight??12*G,refractionAmount:n.refractionAmount??-24*G,depthEffect:n.depthEffect??!1,chromaticAberration:n.chromaticAberration??!1,blurRadius:n.blurRadius??2*G,saturation:n.saturation??1.5,brightness:n.brightness??0,contrast:n.contrast??1,tintColor:[0,0,0,0],surfaceColor:n.surfaceColor??[0,0,0,0],highlight:n.highlight===void 0?{...K}:n.highlight,outerShadow:n.outerShadow===void 0?null:n.outerShadow,label:``,labelColor:[0,0,0,1],showChevron:!1,isInteractive:!1,scroll:r,innerShadow:n.innerShadow??null}}var ht=`M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z`,gt=`M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM4.22 4.22a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 1 1-1.42 1.41L4.22 5.63a1 1 0 0 1 0-1.41zm12.73 12.73a1 1 0 0 1 1.41 0l1.42 1.42a1 1 0 1 1-1.42 1.41l-1.41-1.42a1 1 0 0 1 0-1.41zM2 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1zm17 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1zM4.22 19.78a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.42l-1.41 1.41a1 1 0 0 1-1.42 0zM16.95 7.05a1 1 0 0 1 0-1.41l1.42-1.42a1 1 0 1 1 1.41 1.42l-1.41 1.41a1 1 0 0 1-1.42 0z`,_t=`M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z`;function Z(e,t,n=!1){let r=56*G,i=32*G;return{element:{id:`__back__`,kind:`button`,rect:{x:16,y:16,w:r,h:r},...et,cornerRadius:r/2,tintColor:[0,0,0,0],surfaceColor:t.buttonSurface,highlight:null,outerShadow:{...tt,radius:12*G,alpha:.08},label:``,labelColor:t.backIconColor,showChevron:!1,isInteractive:!0,scroll:n,icon:{path:ht,size:i,color:t.backIconColor}},interaction:{onTap:()=>e()}}}function vt(e,t,n,r,i=!1){let a=56*G,o=32*G;return{element:{id:`__theme__`,kind:`button`,rect:{x:r-16-a,y:16,w:a,h:a},...et,cornerRadius:a/2,tintColor:[0,0,0,0],surfaceColor:t.buttonSurface,highlight:null,outerShadow:{...tt,radius:12*G,alpha:.08},label:``,labelColor:t.backIconColor,showChevron:!1,isInteractive:!0,scroll:i,icon:{path:n?_t:gt,size:o,color:t.backIconColor}},interaction:{onTap:()=>e()}}}function yt(e,t,n,r){let i=n-t;if(i>=r)return n;let a=Math.max(0,(r-i)/2-t);if(a<=0)return n;for(let t of e)t.id!==`__back__`&&t.id!==`__theme__`&&(t.scroll!==!1||t.id===`__pickimage__`)&&(t.rect={...t.rect,y:t.rect.y+a},t.hitRect&&={...t.hitRect,y:t.hitRect.y+a},t.isToggleKnob&&t.isToggleKnob.trackOriginalY!=null&&(t.isToggleKnob.trackOriginalY+=a),t.isBottomTabIndicator&&t.isBottomTabIndicator.containerRect&&(t.isBottomTabIndicator.containerRect={...t.isBottomTabIndicator.containerRect,y:t.isBottomTabIndicator.containerRect.y+a}),t.isBottomTabContent&&t.isBottomTabContent.containerCenterY!=null&&(t.isBottomTabContent.containerCenterY+=a),t.isBottomTabIndicator&&t.isBottomTabIndicator.containerCenterY!=null&&(t.isBottomTabIndicator.containerCenterY+=a),t.isBottomTabIndicator&&t.isBottomTabIndicator.tabContentRects&&(t.isBottomTabIndicator.tabContentRects=t.isBottomTabIndicator.tabContentRects.map(e=>({...e,y:e.y+a}))));return n+a}var bt={transparent:{tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],labelColor:[0,0,0,1]},surface:{tintColor:[0,0,0,0],surfaceColor:[1,1,1,.3],labelColor:[0,0,0,1]},blue:{tintColor:[0,136/255,1,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]},orange:{tintColor:[1,141/255,40/255,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]},red:{tintColor:[1,77/255,79/255,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]},green:{tintColor:[52/255,199/255,75/255,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]},purple:{tintColor:[156/255,39/255,176/255,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]}};function xt(e,t,n,r,i,a){let o=[],s={},c=Z(n,r);o.push(c.element),s[c.element.id]=c.interaction;let l=a&&a.length?a.map((e,t)=>{let n=typeof e.style==`string`?bt[e.style]||bt.blue:e.style||bt.transparent;return{id:e.id||`btn-`+t,label:e.label??`按钮 `+(t+1),tintColor:n.tintColor,surfaceColor:n.surfaceColor,labelColor:n.labelColor}}):[{id:`btn-transparent`,label:`Transparent Liquid Button`,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],labelColor:[0,0,0,1]},{id:`btn-surface`,label:`Surface Liquid Button`,tintColor:[0,0,0,0],surfaceColor:[1,1,1,.3],labelColor:[0,0,0,1]},{id:`btn-tinted-blue`,label:`Tinted Liquid Button`,tintColor:[0,136/255,1,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]},{id:`btn-tinted-orange`,label:`Tinted Liquid Button`,tintColor:[1,141/255,40/255,1],surfaceColor:[0,0,0,0],labelColor:[1,1,1,1]}],u=16*G,d=0;for(let t of l){let n=ct(t.label,Qe),r=Math.ceil(n+2*Ze),a=(e-r)/2,c=pt(t.id,{x:a,y:d,w:r,h:Xe},t);o.push(c),i&&(s[t.id]={onTap:()=>i(t.id)}),d+=Xe+u}return{elements:o,interactions:s,contentHeight:yt(o,0,d-u,t)}}function St(e,t,n,r,i,a,o=q,s=!1,c=!1){let l=[],u={},d=Z(n,o);l.push(d.element),u[d.element.id]=d.interaction;let f=o.toggleAccent,p=o.toggleTrackOff,m=o.toggleCardBg,h=64*G,g=28*G,_=40*G,v=24*G,y=20*G,b=2*G,x=5*G,S=-10*G,C=8*G,w={radius:4*G,alpha:.05,offsetX:0,offsetY:4/6*G,color:[0,0,0]},T={radius:4*G,alpha:.15,offsetX:0,offsetY:4*G},E=!s||!c,D=!s||c,O=e/2-h/2,k=O+b,A=0+(g-v)/2;if(E){let e=Y(`toggle1-track`,{x:O,y:0,w:h,h:g},p,g/2);e.isToggleTrack={groupId:`toggle1`,offColor:p,onColor:[...f,1]},l.push(e);let t=X(`toggle1-knob`,{x:k,y:A,w:_,h:v},{cornerRadius:v/2,refractionHeight:x,refractionAmount:S,blurRadius:C,saturation:1,surfaceColor:[0,0,0,0],highlight:null,outerShadow:w,innerShadow:T,chromaticAberration:!0});t.isToggleKnob={groupId:`toggle1`,dragWidth:y,trackColorOff:p,trackColorOn:[...f,1],trackW:h,trackH:g,trackOriginalX:O,trackOriginalY:0},l.push(t)}let j=24*G;if(D){let t=176*G,n=76*G,r=(e-t)/2,i=E?0+g+16+24:24*G,a=t,o=n,s=32*G,c=m;l.push(Y(`toggle-card`,{x:r,y:i,w:a,h:o},c,s));let u=r+24+32,d=i+24,D=u+b,O=d+(g-v)/2,k=Y(`toggle2-track`,{x:u,y:d,w:h,h:g},p,g/2);k.isToggleTrack={groupId:`toggle2`,offColor:p,onColor:[...f,1]},l.push(k);let A=X(`toggle2-knob`,{x:D,y:O,w:_,h:v},{cornerRadius:v/2,refractionHeight:x,refractionAmount:S,blurRadius:C,saturation:1,surfaceColor:[0,0,0,0],highlight:null,outerShadow:w,innerShadow:T,chromaticAberration:!0});A.isToggleKnob={groupId:`toggle2`,dragWidth:y,trackColorOff:p,trackColorOn:[...f,1],trackW:h,trackH:g,trackOriginalX:u,trackOriginalY:d,solidBackdropColor:c},l.push(A),j=i+o+24}let M=(e,t)=>ut({groupId:e,trackX:0,dragW:t,rendererRef:a,onValueChange:e=>{let t=e>=.5;i(e=>e.toggleOn===t?e:{toggleOn:t})},...ft,snap:e=>+(e>=.5),onTapJump:!1});if(E){let e=M(`toggle1`,y);e.onTap=()=>i(e=>({toggleOn:!e.toggleOn})),u[`toggle1-track`]=e,u[`toggle1-knob`]=e}if(D){let e=M(`toggle2`,y);e.onTap=()=>i(e=>({toggleOn:!e.toggleOn})),u[`toggle2-track`]=e,u[`toggle2-knob`]=e}return{elements:l,interactions:u,contentHeight:yt(l,0,j,t)}}function Ct(e,t,n,r,i,a,o=q,s=!1,c=!1){let l=[],u={},d=Z(n,o);l.push(d.element),u[d.element.id]=d.interaction;let f=o.sliderAccent,p=o.sliderTrackOff,m=o.sliderCardBg,h=32*G,g=6*G,_=40*G,v=24*G,y=!s||!c,b=!s||c,x=h,S=e-2*h,C=x-_/4,w=0+(g-v)/2,T=48*G,E=48*G;if(y){let e=Y(`slider1-track`,{x,y:0,w:S,h:g},p,g/2);e.hitRect={x,y:0+(g-T)/2,w:S,h:T},l.push(e);let t=Y(`slider1-fill`,{x,y:0,w:g,h:g},[...f,1],g/2);t.isSliderFill={groupId:`slider1`,trackX:x,trackW:S,knobW:_,minW:0},l.push(t);let n=X(`slider1-knob`,{x:C,y:w,w:_,h:v},{cornerRadius:v/2,refractionHeight:10*G,refractionAmount:-14*G,blurRadius:8*G,saturation:1,surfaceColor:[0,0,0,0],highlight:null,outerShadow:{radius:4*G,alpha:.05,offsetX:0,offsetY:4/6*G,color:[0,0,0]},innerShadow:{radius:4*G,alpha:.15,offsetX:0,offsetY:4*G},chromaticAberration:!0});n.isToggleKnob={groupId:`slider1`,dragWidth:S-_/2,velocityDivisor:10},n.hitRect={x:C,y:w+(v-E)/2,w:_,h:E},l.push(n)}let D=0+v+24*G,O=24*G,k=e-2*O,A=y?0+v+16+24:24*G,j=32*G,M=O+24+h,N=k-48-2*h,P=A+24+(v-g)/2,F=M-_/4,I=P+(g-v)/2;if(b){l.push(Y(`slider-card`,{x:O,y:A,w:k,h:72},m,j));let e=Y(`slider2-track`,{x:M,y:P,w:N,h:g},p,g/2);e.hitRect={x:M,y:P+(g-T)/2,w:N,h:T},l.push(e);let t=Y(`slider2-fill`,{x:M,y:P,w:g,h:g},[...f,1],g/2);t.isSliderFill={groupId:`slider2`,trackX:M,trackW:N,knobW:_,minW:0},l.push(t);let n=X(`slider2-knob`,{x:F,y:I,w:_,h:v},{cornerRadius:v/2,refractionHeight:10*G,refractionAmount:-14*G,blurRadius:8*G,saturation:1,surfaceColor:[0,0,0,0],highlight:null,outerShadow:{radius:4*G,alpha:.05,offsetX:0,offsetY:4/6*G,color:[0,0,0]},innerShadow:{radius:4*G,alpha:.15,offsetX:0,offsetY:4*G},chromaticAberration:!0});n.isToggleKnob={groupId:`slider2`,dragWidth:N-_/2,velocityDivisor:10},n.hitRect={x:F,y:I+(v-E)/2,w:_,h:E},l.push(n),D=A+72+24*G}let ee=S-_/2,L=(e,t,n)=>ut({groupId:e,trackX:t,dragW:n,rendererRef:a,onValueChange:e=>i({sliderValue:e*100}),...dt,liveUpdate:!1});return y&&(u[`slider1-track`]=L(`slider1`,x,ee),u[`slider1-knob`]=u[`slider1-track`]),b&&(u[`slider2-track`]=L(`slider2`,M,N-_/2),u[`slider2-knob`]=u[`slider2-track`]),{elements:l,interactions:u,contentHeight:yt(l,0,D,t)}}function wt(e,t,n,r,i,a=null,o=q,s,c=!1,l=!1){let u=[],d={},f=Z(n,o);u.push(f.element),d[f.element.id]=f.interaction;let p=36*G,m=e-2*p,h=o.tabsContentColor,g=o.tabsContainer,_=o.tabsAccent,v=64*G,y=56*G,b=4*G,x=p,S=m,C=v/2,w=p+b,T=m-2*b,E=y/2;function D(e,t,n,r,i){let s=t?t.length:3,c=T/s,l=i+b,f=X(`${e}-container`,{x,y:i,w:S,h:v},{cornerRadius:C,refractionHeight:24*G,refractionAmount:-24*G,blurRadius:8*G,saturation:1.5,surfaceColor:g,highlight:{...K,alpha:1},outerShadow:null,depthEffect:!0});f.isBottomTabContainer={groupId:e,tabsCount:s},u.push(f);let m=mt(e,c,s,r,a);for(let n=0;n<s;n++){let a=`${e}-tab-${n}`,s=t?.[n],f=s?.icon??at,p=s?.label??`Tab ${n+1}`,g=J(a,{x:w+c*n,y:l,w:c,h:y},p,{color:o.tabsContentColor,fontSizePx:12,fontWeight:400,align:`center`,paddingPx:0,halo:o.tabsTextHalo,icon:{path:f,size:24,layoutSize:28,color:h,viewport:s?.viewport??960}});g.isBottomTabContent={groupId:e,containerCenterX:x+S/2,containerCenterY:i+v/2,containerWidth:S},u.push(g),d[a]={onTap:()=>r(n),onDragStart:m.onDragStart,onDrag:m.onDrag,onDragEnd:m.onDragEnd}}d[`${e}-container`]=m;let D=X(`${e}-indicator`,{x:p+b,y:l,w:c,h:y},{cornerRadius:E,refractionHeight:10*G,refractionAmount:-14*G,blurRadius:0,saturation:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:{...K,alpha:1},outerShadow:{radius:24*G,alpha:.1,offsetX:0,offsetY:4*G,color:[0,0,0]},innerShadow:{radius:8*G,alpha:.15,offsetX:0,offsetY:8*G},chromaticAberration:!0});D.isBottomTabIndicator={groupId:e,dragWidth:c,dimColor:o.backIconColor,accentColor:[..._],containerRect:{x:w,y:l,w:T,h:y},containerCenterX:x+S/2,containerCenterY:i+v/2,containerWidth:S,tabContentIds:Array.from({length:s},(t,n)=>`${e}-tab-${n}`),tabContentRects:Array.from({length:s},(e,t)=>({x:w+c*t,y:l,w:c,h:y}))},u.push(D)}let O=!l,k=!c||l,A=O?v+32:0;if(O&&D(`tabs3`,s?.[0]??null,r.selectedTab,e=>i({selectedTab:e}),0),k){let e=[{icon:at,label:`Tab 1`},{icon:at,label:`Tab 2`},{icon:at,label:`Tab 3`},{icon:at,label:`Tab 4`}];D(`tabs4`,s?.[1]??e,r.selectedTab2,e=>i({selectedTab2:e}),A)}return{elements:u,interactions:d,contentHeight:yt(u,0,+!!O+ +!!k==2?2*v+32:v,t)}}function Tt(e,t,n,r,i=q,a,o){let s=[],c={},l=a?.title??`Dialog Title`,u=a?.body??it,d=a?.cancelText??`Cancel`,f=a?.okayText??`Okay`,p=Z(n,i,!0);s.push(p.element),c[p.element.id]=p.interaction;let m=Y(`dialog-scrim`,{x:0,y:0,w:e,h:t},i.dialogDim,0);m.scroll=!1,s.push(m);let h=40*G,g=420*G,_=Math.min(e-2*h,g),v=(e-_)/2,y=276*G,b=(t-y)/2,x=X(`dialog-card`,{x:v,y:b,w:_,h:y},{cornerRadius:48*G,refractionHeight:24*G,refractionAmount:-48*G,blurRadius:i.dialogBlurRadius,saturation:1.5,brightness:i.dialogBrightness,surfaceColor:i.dialogContainer,highlight:{...K,mode:2,color:[1,1,1],alpha:.38,widthDp:.5},outerShadow:null,depthEffect:!0});x.useSeparableBlur=!0,r.capsuleShape&&(x.useContinuousSdf=!0),s.push(x),s.push(J(`dialog-title`,{x:v+28,y:b+24,w:_-56,h:36},l,{color:i.dialogContentColor,fontSizePx:24,fontWeight:500,align:`left`,paddingPx:0,halo:`none`}));let S=i.dialogBrightness>.1?.68:.78,C=[i.dialogContentColor[0],i.dialogContentColor[1],i.dialogContentColor[2],S];s.push(J(`dialog-body`,{x:v+24,y:b+68+12,w:_-48,h:100},u,{color:C,fontSizePx:15,fontWeight:400,align:`left`,wrap:!0,valign:`top`,maxLines:5,paddingPx:0,halo:`none`}));let w=48*G,T=(_-48*G-16*G)/2,E=b+y-24*G-w,D=v+24*G,O=D+T+16*G,k=pt(`dialog-cancel`,{x:D,y:E,w:T,h:w},{label:``,tintColor:[0,0,0,0],surfaceColor:[i.dialogContainer[0],i.dialogContainer[1],i.dialogContainer[2],.2],labelColor:i.dialogContentColor,saturation:1,brightness:0,contrast:1},!1);k.refractionHeight=0,k.refractionAmount=0,k.blurRadius=0,k.highlight=null,k.outerShadow=null,s.push(k),c[`dialog-cancel`]={onTap:()=>o?.(`cancel`)},s.push(J(`dialog-cancel-label`,{x:D,y:E,w:T,h:w},d,{color:i.dialogContentColor,fontSizePx:16,fontWeight:400,align:`center`,paddingPx:0,halo:`none`}));let A=pt(`dialog-okay`,{x:O,y:E,w:T,h:w},{label:``,tintColor:[0,0,0,0],surfaceColor:i.dialogAccent,labelColor:[1,1,1,1],saturation:1,brightness:0,contrast:1},!1);A.refractionHeight=0,A.refractionAmount=0,A.blurRadius=0,A.highlight=null,A.outerShadow=null,s.push(A),c[`dialog-okay`]={onTap:()=>o?.(`okay`)},s.push(J(`dialog-okay-label`,{x:O,y:E,w:T,h:w},f,{color:[1,1,1,1],fontSizePx:16,fontWeight:400,align:`center`,paddingPx:0}));for(let e of s)e.scroll=!1;return yt(s,0,t,t),{elements:s,interactions:c,contentHeight:t}}var Et={x:0,y:0};function Dt(e,t,n){let r=t*1.35,i=e.split(/\s+/),a=``,o=0;for(let e of i){let r=a?a+` `+e:e;ct(r,t)<=n||!a?a=r:(o++,a=e)}return a&&o++,o*r}function Ot(e,t,n,r,i,a=q){let o=[],s={},c=Z(n,a);o.push(c.element),s[c.element.id]=c.interaction;let l=24*G,u=e-2*l,d=32*G,f=24*G,p=u-2*f,m=Dt(it,16,p),h=m+2*f;o.push(Y(`mag-card`,{x:l,y:0,w:u,h},a.magnifierCardBg,d)),o.push(J(`mag-text`,{x:l+f,y:0+f,w:p,h:m},it,{color:a.magnifierContentColor,fontSizePx:16,fontWeight:400,align:`left`,wrap:!0,paddingPx:0,halo:`none`}));let g=e/2-2,_=0+h/2-12*G,v=g+r.magnifierX,y=_+r.magnifierY,b=Y(`mag-cursor`,{x:v,y,w:4*G,h:24*G},a.magnifierAccent,2*G);b.hitRect={x:v-22*G,y:y-12*G,w:48*G,h:48*G},o.push(b);let x=128*G,S=96*G,C=X(`mag-glass`,{x:v+2-x/2,y:y+12-80*G-S/2,w:x,h:S},{cornerRadius:S/2,refractionHeight:8*G,refractionAmount:-24*G,blurRadius:0,saturation:1,surfaceColor:[0,0,0,0],highlight:{...K},outerShadow:{...tt},innerShadow:{radius:16*G,alpha:.15,offsetX:0,offsetY:16*G},depthEffect:!0,chromaticAberration:!0});C.isMagnifier={zoom:1.5,sampleOffsetY:80*G},o.push(C);let w={onDragStart:()=>{Et.x=r.magnifierX,Et.y=r.magnifierY},onDrag:(e,t)=>{i({magnifierX:Et.x+t.x,magnifierY:Et.y+t.y})},onDragEnd:()=>{}};return s[`mag-glass`]=w,s[`mag-cursor`]=w,{elements:o,interactions:s,contentHeight:yt(o,0,h,t)}}function kt(e,t,n,r=q,i,a){let o=[],s={},c=Z(t,r);o.push(c.element),s[c.element.id]=c.interaction;let l=16*G,u=16*G,d=e-2*l,f=160*G,p=i&&i.length>0?i:null,m=p?p.length:n,h=80;for(let e=0;e<m;e++){o.push(X(`sc-card-${e}`,{x:l,y:h,w:d,h:f},{cornerRadius:32*G,refractionHeight:16*G,refractionAmount:-32*G,blurRadius:0,saturation:1.5,surfaceColor:[0,0,0,0],highlight:{...K},outerShadow:null}));let t=p?.[e];if(t&&(o.push(J(`sc-title-${e}`,{x:l+16*G,y:h+18*G,w:d-32*G,h:24*G},t.title,{color:r.homeContentColor,fontSizePx:17,fontWeight:600,align:`left`,valign:`top`,paddingPx:0,scroll:!0,halo:r.homeTextHalo})),t.subtitle&&o.push(J(`sc-sub-${e}`,{x:l+16*G,y:h+18*G+28*G,w:d-32*G,h:20*G},t.subtitle,{color:r.homeSubtitleColor,fontSizePx:14,fontWeight:400,align:`left`,valign:`top`,paddingPx:0,scroll:!0,halo:r.homeTextHalo})),t.link&&t.link.text)){let n=r.homeTextHalo===`dark`?[.1,.4,.9,1]:[.36,.58,1,1],i=J(`sc-link-${e}`,{x:l+16*G,y:h+f-34*G,w:d-32*G,h:22*G},t.link.text,{color:n,fontSizePx:15,fontWeight:600,align:`left`,valign:`center`,paddingPx:0,scroll:!0,halo:r.homeTextHalo});i.isInteractive=!0,o.push(i),a&&(s[`sc-link-${e}`]={onTap:()=>a(e,t.link?.href)})}h+=f+u}return{elements:o,interactions:s,contentHeight:h+16}}var At=`M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z`,jt=5,Q=36*G,Mt=12*G,Nt=24,Pt=60*G;function Ft(e,t,n,r,i,a,o){let s=o??rt(!0),c=[],l={},u=(e-(jt*Q+(jt-1)*Mt))/2,d=Math.max(Pt,(t-Q)/2),f=Z(n,s);c.push(f.element),f.interaction&&(l[f.element.id]=f.interaction);let p=[1,204/255,0,1],m=[.4,.4,.4,.5];for(let e=0;e<jt;e++){let t=`star-${e}`,n=u+e*(Q+Mt);n+Q/2,d+Q/2;let a=r.ratingValue>e,o=a?p:m,s={id:t,kind:`button`,rect:{x:n,y:d,w:Q,h:Q},cornerRadius:Q/2,refractionHeight:6*G,refractionAmount:-12*G,depthEffect:!1,chromaticAberration:!1,blurRadius:2*G,saturation:1.5,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:a?[1,204/255,0,.15]:[.5,.5,.5,.1],highlight:K,outerShadow:{radius:8*G,alpha:.15,offsetX:0,offsetY:2*G,color:[0,0,0]},label:``,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!0,icon:{path:At,size:Q*.7,color:o,viewport:Nt,layoutSize:Q}};c.push(s),l[t]={onTap:()=>{i({ratingValue:r.ratingValue===e+1?0:e+1})},onDragStart:()=>{},onDrag:()=>{},onDragEnd:()=>{}}}return{elements:c,interactions:l,contentHeight:Math.max(t,d+Q+20*G)}}var $=180*G,It=20*G,Lt=$/2-It,Rt=$/2,zt=60*G;function Bt(e,t,n,r,i,a){let o=e=>e-Math.PI/2,s=o(i),c=o(a),l=Math.cos(s),u=Math.sin(s),d=Math.cos(c),f=Math.sin(c),p=e+r*l,m=t+r*u,h=e+r*d,g=t+r*f,_=e+n*d,v=t+n*f,y=e+n*l,b=t+n*u,x=+(a-i>Math.PI);return[`M ${p} ${m}`,`A ${r} ${r} 0 ${x} 1 ${h} ${g}`,`L ${_} ${v}`,`A ${n} ${n} 0 ${x} 0 ${y} ${b}`,`Z`].join(` `)}function Vt(e,t,n,r,i,a,o){let s=o,c=[],l={},u=e/2,d=Math.max(zt+$/2,t/2),f=u-$/2,p=d-$/2,m=Z(n,s);c.push(m.element),m.interaction&&(l[m.element.id]=m.interaction),c.push({id:`ring-bg`,kind:`glass-shape`,rect:{x:f,y:p,w:$,h:$},cornerRadius:$/2,refractionHeight:8*G,refractionAmount:-16*G,depthEffect:!1,chromaticAberration:!1,blurRadius:3*G,saturation:1.5,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:s.buttonSurface,highlight:K,outerShadow:tt,label:``,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!1});let h=r.ringProgressValue,g=h/100*Math.PI*2,_=[0,145/255,1,1],v=[.3,.3,.3,.3],y=Bt(u-f,d-p,Lt,Rt,0,Math.PI*2);if(c.push({id:`ring-track`,kind:`button`,rect:{x:f,y:p,w:$,h:$},cornerRadius:$/2,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:``,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!1,icon:{path:y,size:$,color:v,viewport:$}}),g>.001){let e=Bt(u-f,d-p,Lt,Rt,0,g);c.push({id:`ring-fill`,kind:`button`,rect:{x:f,y:p,w:$,h:$},cornerRadius:$/2,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:``,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!1,icon:{path:e,size:$,color:_,viewport:$}})}let b=`${Math.round(h)}%`,x=36*G;c.push({id:`ring-label`,kind:`text`,rect:{x:f,y:p,w:$,h:$},cornerRadius:0,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:``,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!1,text:{content:b,color:s.homeContentColor,fontSizePx:x,fontWeight:700,align:`center`,valign:`center`}});let S=$/2;return c.push({id:`ring-dec`,kind:`button`,rect:{x:f,y:p,w:S,h:$},cornerRadius:0,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:``,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!0}),l[`ring-dec`]={onTap:()=>{i({ringProgressValue:Math.max(0,r.ringProgressValue-10)})},onDragStart:()=>{},onDrag:()=>{},onDragEnd:()=>{}},c.push({id:`ring-inc`,kind:`button`,rect:{x:f+S,y:p,w:S,h:$},cornerRadius:0,refractionHeight:0,refractionAmount:0,depthEffect:!1,chromaticAberration:!1,blurRadius:0,saturation:1,brightness:0,contrast:1,tintColor:[0,0,0,0],surfaceColor:[0,0,0,0],highlight:null,outerShadow:null,label:``,labelColor:[1,1,1,1],showChevron:!1,isInteractive:!0}),l[`ring-inc`]={onTap:()=>{i({ringProgressValue:Math.min(100,r.ringProgressValue+10)})},onDragStart:()=>{},onDrag:()=>{},onDragEnd:()=>{}},{elements:c,interactions:l,contentHeight:Math.max(t,p+$+20*G)}}function Ht(e,t){return{elements:[],interactions:{},contentHeight:t}}var Ut=`attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }`,Wt=.75,Gt=class{constructor(e){n(this,`_canvas`),n(this,`_gl`,null),n(this,`_prog`,null),n(this,`_buf`,null),n(this,`_U`,{}),n(this,`_raf`,0),n(this,`_start`,0),n(this,`_variant`,`wave`),n(this,`_speed`,1),n(this,`_scale`,1),n(this,`_dpr`,1),n(this,`_w`,0),n(this,`_h`,0),n(this,`_killed`,!1),this._canvas=e;try{this._gl=e.getContext(`webgl`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1})}catch{this._gl=null}if(!this._gl){console.warn(`[liquid-glass] siri-wave: WebGL not available`);return}this._compile()}get variant(){return this._variant}set variant(e){e!==this._variant&&(this._variant=e===`orb`?`orb`:`wave`,this._compile())}get speed(){return this._speed}set speed(e){this._speed=e>0?e:1}get scale(){return this._scale}set scale(e){this._scale=e>0?e:1}get dpr(){return this._dpr}set dpr(e){this._dpr=e>0?e:1,this._applySize()}resize(e,t){this._w=e,this._h=t,this._applySize()}_applySize(){let e=this._gl;if(!e||!this._w||!this._h)return;let t=Math.max(1,Math.round(this._w*this._dpr*Wt)),n=Math.max(1,Math.round(this._h*this._dpr*Wt));this._canvas.width!==t&&(this._canvas.width=t),this._canvas.height!==n&&(this._canvas.height=n),e.viewport(0,0,t,n)}_compile(){let e=this._gl;if(!e)return;this._prog&&=(e.deleteProgram(this._prog),null);let t=this._shader(e.VERTEX_SHADER,Ut),n=this._variant===`orb`?j:A,r=this._shader(e.FRAGMENT_SHADER,n);if(!t||!r)return;let i=e.createProgram();if(e.attachShader(i,t),e.attachShader(i,r),e.linkProgram(i),e.deleteShader(t),e.deleteShader(r),!e.getProgramParameter(i,e.LINK_STATUS)){console.warn(`[liquid-glass] siri-wave: link failed:`,e.getProgramInfoLog(i)),e.deleteProgram(i);return}this._prog=i,this._buf||(this._buf=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this._buf),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW)),e.useProgram(i);let a=e.getAttribLocation(i,`aPos`);e.enableVertexAttribArray(a),e.vertexAttribPointer(a,2,e.FLOAT,!1,0,0),this._U.iResolution=e.getUniformLocation(i,`iResolution`),this._U.iTime=e.getUniformLocation(i,`iTime`),this._U.uSpeed=e.getUniformLocation(i,`uSpeed`),this._U.uScale=e.getUniformLocation(i,`uScale`)}_shader(e,t){let n=this._gl,r=n.createShader(e);return r?(n.shaderSource(r,t),n.compileShader(r),n.getShaderParameter(r,n.COMPILE_STATUS)?r:(console.warn(`[liquid-glass] siri-wave: compile error:`,n.getShaderInfoLog(r)),n.deleteShader(r),null)):null}start(){if(this._raf||!this._gl)return;this._start||=performance.now();let e=()=>{if(this._killed)return;let t=this._gl,n=this._prog;if(t&&n){let e=(performance.now()-this._start)/1e3;t.useProgram(n),this._U.iResolution&&t.uniform2f(this._U.iResolution,this._canvas.width,this._canvas.height),this._U.iTime&&t.uniform1f(this._U.iTime,e),this._U.uSpeed&&t.uniform1f(this._U.uSpeed,this._speed),this._U.uScale&&t.uniform1f(this._U.uScale,this._scale),t.drawArrays(t.TRIANGLES,0,3)}this._raf=requestAnimationFrame(e)};this._raf=requestAnimationFrame(e)}stop(){this._raf&&=(cancelAnimationFrame(this._raf),0)}kill(){this._killed=!0,this.stop();let e=this._gl;e&&(this._prog&&=(e.deleteProgram(this._prog),null),this._buf&&=(e.deleteBuffer(this._buf),null))}};function Kt(e,t,n,r,i,a,o,s,c=!0,l,u,d,f,p,m,h,g){let _=rt(c),v;switch(e){case 0:v=xt(t,n,o,_,u,f);break;case 1:v=St(t,n,o,r,i,s,_);break;case 3:v=Ct(t,n,o,r,i,s,_);break;case 4:v=Ct(t,n,o,r,i,s,_,!0);break;case 2:v=St(t,n,o,r,i,s,_,!0);break;case 6:v=wt(t,n,o,r,i,s,_,d,!0);break;case 7:v=St(t,n,o,r,i,s,_,!0,!0);break;case 8:v=Ct(t,n,o,r,i,s,_,!0,!0);break;case 9:v=wt(t,n,o,r,i,s,_,d,!0,!0);break;case 5:v=wt(t,n,o,r,i,s,_,d);break;case 10:v=Tt(t,n,o,r,_,p,m);break;case 11:v=Ot(t,n,o,r,i,_);break;case 12:v=kt(t,o,20,_,h,g);break;case 13:v=kt(t,o,100,_,h,g);break;case 14:v=Ft(t,n,o,r,i,s,_);break;case 15:v=Vt(t,n,o,r,i,s,_);break;case 16:v=Ht(t,n);break;default:v=xt(t,n,o,_,u)}let y=r.hideOverlayButtons,b=v.elements.findIndex(e=>e.id===`__back__`);if(b>=0){if(y)v.elements.splice(b,1),delete v.interactions.__back__;else{let[e]=v.elements.splice(b,1);v.elements.push(e)}}if(l&&!y){let e=vt(l,_,c,t,!1);r.globalSeparableBlur&&(e.element.useSeparableBlur=!0),v.elements.push(e.element),v.interactions[e.element.id]=e.interaction}if(r.globalSeparableBlur)for(let e of v.elements)(e.kind===`button`||e.kind===`glass-shape`)&&!e.isSdfTexture&&!e.isToggleKnob&&!e.isBottomTabIndicator&&!e.isMagnifier&&(e.useSeparableBlur=!0);return v}var qt=`#version 300 es
precision highp float;
uniform vec2  uRes;
uniform vec4  uBlob;   // cx, cy, halfX, halfY (px, y 向下)
uniform float uEdge;   // 顶部黑边高度
uniform float uK;      // 融合半径
uniform float uHeight, uRefract, uHlAmt, uAb, uDpr, uCont;
uniform float uDark;   // 液滴材质 1=贴边黑玻璃 0=落地浅磨砂
uniform float uValid;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2  uTexSize;
out vec4 outColor;

// ---------- 背景:壁纸纹理 (cover-fit),加载失败降级程序化地图 ----------
// blurR>0 时按苹果的 blur→mip 映射取 LOD: lod = log2(r<2 ? r/2+1 : r)
vec3 bgcol(vec2 p, float blurR){
  if (uHasTex > 0.5) {
    float s  = max(uRes.x / uTexSize.x, uRes.y / uTexSize.y);
    vec2  uv = (p - 0.5 * (uRes - uTexSize * s)) / (uTexSize * s);
    float lod = max(0.0, log2(blurR < 2.0 ? blurR * 0.5 + 1.0 : blurR));
    return textureLod(uTex, clamp(uv, vec2(0.002), vec2(0.998)), lod).rgb;
  }
  vec2 st = p / uRes.y;
  vec2 g  = fract(st * 6.0) - 0.5;
  float street = smoothstep(0.43, 0.455, max(abs(g.x), abs(g.y)));
  vec3 c = mix(vec3(0.90, 0.885, 0.85), vec3(0.985, 0.975, 0.96), street);
  c = mix(c, vec3(0.78, 0.88, 0.71), 1.0 - smoothstep(0.10, 0.30, length(st - vec2(0.33, 0.62))));
  c = mix(c, vec3(0.69, 0.83, 0.93), 1.0 - smoothstep(0.15, 0.42, length(st - vec2(1.55, 0.40))));
  for (int i = 0; i < 6; i++) {
    vec2 q = vec2(0.21 + 0.27 * float(i), fract(0.37 + 0.61 * float(i)) * 0.8 + 0.12);
    float d = length(st - q) * uRes.y;
    c = mix(c, vec3(0.95, 0.45, 0.25), 1.0 - smoothstep(7.0, 9.0, d));
    c = mix(c, vec3(1.0), 1.0 - smoothstep(2.5, 4.0, d));
  }
  c *= 1.0 - 0.10 * st.y / (uRes.x / uRes.y);   // 轻微纵向渐变
  return c;
}

// ---------- rounded-box SDF + 解析梯度 ----------
// supercircle_sdf 的圆角分支(cornerFlags=圆角);圆/胶囊/圆角矩形同一原语
vec4 sdRoundBox(vec2 p, vec2 c, vec2 b, float r){
  vec2 lp = p - c;
  vec2 q  = abs(lp) - b + r;
  vec2 mq = max(q, vec2(0.0));
  float dOut = length(mq);
  float d = dOut + min(max(q.x, q.y), 0.0) - r;
  vec2 grad = (dOut > 1e-4) ? (mq / dOut) * sign(lp)
            : ((q.x > q.y) ? vec2(sign(lp.x), 0.0) : vec2(0.0, sign(lp.y)));
  return vec4(d, grad, 1.0);
}

// ---------- 苹果 sdf_union:梯度感知 smooth min ----------
// QuartzCore ShaderUtils_::sdf_union 逐行翻译
vec4 sdfUnion(vec4 a, vec4 b, float k){
  if (b.w == 0.0) b = vec4(10000.0, 0.0, 0.0, 0.0);     // half 0x70E2
  float kEff = k * clamp(0.5 - 0.5 * dot(a.yz, b.yz), 0.0, 1.0) + 1e-4;
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / kEff, 0.0, 1.0);
  float d = mix(b.x, a.x, h) - kEff * h * (1.0 - h);    // IQ 多项式 smin
  vec2  g = mix(b.yz, a.yz, h);                         // 梯度同步混合
  return vec4(d, normalize(g + vec2(1e-5)), 1.0);
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);  // y 向下,对齐 UI 坐标

  vec4 bar  = vec4(p.y - uEdge, 0.0, 1.0, 1.0);            // 顶部黑边 = 半平面
  vec4 blob = sdRoundBox(p, uBlob.xy, uBlob.zw, min(uBlob.z, uBlob.w));
  blob.w = uValid;
  vec4 s = sdfUnion(bar, blob, uK);
  float d = s.x;  vec2 g = s.yz;

  // 背景 + 外侧软阴影 (sdf_shadow)
  float sh = (d > 0.0) ? exp(-d / 30.0) * 0.22 : 0.0;
  vec3 col = bgcol(p, 0.0) * (1.0 - sh);

  // ---------- 玻璃 = 折射 + 高光,无 face color ----------
  // 公式同 QuartzCore sdf_glass_displacement/highlight,参数取 z1han siri27 标定
  float wb = uValid * clamp(0.5 + 0.5 * (bar.x - blob.x) / 24.0, 0.0, 1.0);
  float darkAmt = mix(1.0, uDark, wb);

  // 梯度向"中心径向"微混 8%,透镜更圆润(只对液滴,bar 区域 wb≈0)
  vec2 lp = p - uBlob.xy;
  vec2 radial = normalize(vec2(lp.x, uBlob.z * lp.y / max(uBlob.w, 0.001)) + 1e-5);
  vec2 gr = normalize(mix(g, radial, 0.08 * wb));

  // 圆弧剖面 (curvature=1),折射量为负 → 边缘把外侧内容"拉进来"(放大镜感)
  float t   = clamp(-d / uHeight, 0.0, 1.0);
  float mag = 1.0 - sqrt(max(1.0 - (1.0 - t) * (1.0 - t), 0.0));
  vec2  dsp = -uRefract * mag * gr;
  // 边缘环:近清晰采样 + 色差
  vec3 sharp;
  sharp.r = bgcol(p + dsp * (1.0 - uAb), 3.0).r;
  sharp.g = bgcol(p + dsp, 3.0).g;
  sharp.b = bgcol(p + dsp * (1.0 + uAb), 3.0).b;
  // 内部:8 抽样圆盘 + 中等 mip 联合模糊——纯 mip 三线性有块感,圆盘把它抹匀
  float br = mix(14.0, 60.0, clamp(-d / (50.0 * uDpr), 0.0, 1.0)) * uDpr;
  vec3 soft = bgcol(p + dsp, br * 0.4) * 0.2;
  for (int i = 0; i < 8; i++) {
    float a = 0.7854 * float(i);
    soft += bgcol(p + dsp + vec2(cos(a), sin(a)) * br * 0.7, br * 0.4) * 0.1;
  }
  float deep = clamp(-d / (40.0 * uDpr), 0.0, 1.0);   // 越深入越用模糊
  vec3 refr = mix(sharp, soft, deep);

  // face 压暗 = 乘法系数的垂直渐变(真机截图逐像素实测标定):
  // 顶 ×0.03(近纯黑) 中 ×0.19 底 ×0.34,线性 m ≈ 0.20 + 0.40·ny;
  // 用乘法不残留底图对比(不发花),用渐变还原"上黑下透"
  float ny = (p.y - uBlob.y) / max(uBlob.w, 1.0);   // -1=顶 +1=底
  float m  = clamp(0.20 + 0.40 * ny, 0.0, 1.0);
  float crush = mix(1.0, m, uCont * wb);
  refr = refr * crush + vec3(0.008, 0.010, 0.014) * uCont * wb;

  // edge_bleed(IR 解码):亮背景从边缘渗入玻璃内侧——圆剖面位移 + mip 模糊
  // + 贴边距离带 + 亮度四次方门控(背景越亮渗越多,暗处几乎不渗)
  float xb  = clamp(-d / (10.0 * uDpr), 0.0, 1.0);
  float dbl = 24.0 * uDpr * (1.0 - sqrt(xb * (2.0 - xb)));
  vec3 bleed = bgcol(p + gr * dbl, 22.0);
  float wbd  = clamp((d + 26.0 * uDpr) / (20.0 * uDpr), 0.0, 1.0);
  float blum = dot(bleed, vec3(0.2125, 0.7154, 0.0721));
  float bm   = pow(clamp(blum * 1.2, 0.0, 1.0), 2.0) * wbd;
  refr = mix(refr, bleed, bm * bm * 0.85);

  vec3 glass = mix(refr, refr * 0.10 + vec3(0.016), darkAmt); // 落地=纯玻璃,贴边=黑玻璃

  // 高光:细带 2.2px,key 45° + fill 225° 对角双光,锐掩码 cut 0.52,压缩 norm 8
  float qd  = -d;
  float hw  = 2.2 * uDpr;
  float aaq = max(fwidth(qd), 1e-3);
  float band = (1.0 - clamp(qd / hw, 0.0, 1.0))
             * clamp(qd / aaq + 0.5, 0.0, 1.0)
             * clamp((hw - qd) / aaq + 0.5, 0.0, 1.0);
  vec2 kdir = vec2(0.7071, 0.7071);
  float key  = band * clamp((dot(kdir, gr) - 0.52) / 0.48, 0.0, 1.0);
  float fill = band * clamp((dot(-kdir, gr) - 0.52) / 0.48, 0.0, 1.0);
  key  = key  / (1.0 + (1.0 - key)  * 8.0);
  fill = fill / (1.0 + (1.0 - fill) * 8.0);
  glass += (key + fill) * uHlAmt * mix(1.0, 0.4, darkAmt);

  float aaw = max(fwidth(d), 1e-3);
  col = mix(col, glass, smoothstep(aaw, -aaw, d));
  outColor = vec4(col, 1.0);
}`,Jt=`#version 300 es
void main(){ vec2 v = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
  gl_Position = vec4(v*2.0-1.0, 0.0, 1.0); }`,Yt=class{constructor(e){n(this,`x`),n(this,`v`),n(this,`t`),n(this,`om`,11),n(this,`ze`,.72),this.x=e,this.v=0,this.t=e}set(e,t){return this.om=e,this.ze=t,this}step(e){return this.v+=(this.om*this.om*(this.t-this.x)-2*this.ze*this.om*this.v)*e,this.x+=this.v*e,this.x}},Xt=26,Zt=34,Qt={k:64,height:18,refract:14,hl:1.5,ab:.12,cont:.5,om:11,ze:.72},$t=class{constructor(e){n(this,`_canvas`),n(this,`_gl`,null),n(this,`_prog`,null),n(this,`_U`,{}),n(this,`_tex`,null),n(this,`_hasTex`,0),n(this,`_texSize`,[1,1]),n(this,`_dpr`,1),n(this,`_w`,0),n(this,`_h`,0),n(this,`_raf`,0),n(this,`_last`,0),n(this,`_killed`,!1),n(this,`_wallpaperUrl`,``),n(this,`state`,`IDLE`),n(this,`pointer`,{x:0,y:0}),n(this,`_sp`,{cx:new Yt(0),cy:new Yt(0),bx:new Yt(0),by:new Yt(0),k:new Yt(64),dark:new Yt(1),cont:new Yt(0)}),n(this,`_P`,{...Qt}),n(this,`onCapsuleChange`,null),this._canvas=e;try{this._gl=e.getContext(`webgl2`,{antialias:!1})}catch{this._gl=null}if(!this._gl){console.warn(`[liquid-glass-search] WebGL2 not available`);return}this._compile(),this._initTexture()}get dpr(){return this._dpr}set dpr(e){this._dpr=e>0?e:1,this._applySize()}get wallpaper(){return this._wallpaperUrl}set wallpaper(e){e!==this._wallpaperUrl&&(this._wallpaperUrl=e,e&&this._loadWallpaper(e))}resize(e,t){this._w=e,this._h=t,this._applySize()}_applySize(){let e=this._gl;if(!e||!this._w||!this._h)return;let t=Math.max(1,Math.round(this._w*this._dpr)),n=Math.max(1,Math.round(this._h*this._dpr));this._canvas.width!==t&&(this._canvas.width=t),this._canvas.height!==n&&(this._canvas.height=n),e.viewport(0,0,t,n)}_compile(){let e=this._gl;if(!e)return;let t=this._shader(e.VERTEX_SHADER,Jt),n=this._shader(e.FRAGMENT_SHADER,qt);if(!t||!n)return;let r=e.createProgram();if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),e.deleteShader(t),e.deleteShader(n),!e.getProgramParameter(r,e.LINK_STATUS)){console.warn(`[liquid-glass-search] link failed:`,e.getProgramInfoLog(r)),e.deleteProgram(r);return}this._prog=r,e.useProgram(r);let i=[`uRes`,`uBlob`,`uEdge`,`uK`,`uHeight`,`uRefract`,`uHlAmt`,`uAb`,`uDpr`,`uDark`,`uCont`,`uValid`,`uTex`,`uHasTex`,`uTexSize`];this._U={};for(let t of i)this._U[t]=e.getUniformLocation(r,t);e.uniform1i(this._U.uTex,0)}_shader(e,t){let n=this._gl,r=n.createShader(e);return r?(n.shaderSource(r,t),n.compileShader(r),n.getShaderParameter(r,n.COMPILE_STATUS)?r:(console.warn(`[liquid-glass-search] compile error:`,n.getShaderInfoLog(r)),n.deleteShader(r),null)):null}_initTexture(){let e=this._gl;e&&(this._tex=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this._tex),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE))}_loadWallpaper(e){let t=this._gl;if(!t||!this._tex)return;let n=new Image;n.crossOrigin=`anonymous`,n.onload=()=>{try{t.bindTexture(t.TEXTURE_2D,this._tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,n),t.generateMipmap(t.TEXTURE_2D),this._hasTex=1,this._texSize=[n.width,n.height]}catch{this._hasTex=0}},n.onerror=()=>{this._hasTex=0},n.src=e}onDown(e,t){if(this.state===`CAPSULE`){let n=this.capsuleRect();Math.abs(e-n.x)<=n.w/2+8&&Math.abs(t-n.y)<=n.h/2+8||this.retract();return}this.state=`DRAG`,this.pointer={x:e,y:t};let n=this._sp;n.cx.x=e,n.cx.v=0,n.cy.x=Xt*.5,n.cy.v=0,n.bx.x=n.by.x=2,n.cx.set(18,.95),n.cy.set(18,.95),n.bx.set(this._P.om,this._P.ze),n.by.set(this._P.om,this._P.ze),n.dark.t=1,n.k.t=this._P.k,n.cont.t=0}onMove(e,t){this.state===`DRAG`&&(this.pointer={x:e,y:t})}onUp(){if(this.state===`DRAG`){if(this.pointer.y>this._h*.32){this.state=`CAPSULE`;let e=this.capsuleRect(),t=this._sp;for(let e of[t.cx,t.cy,t.bx,t.by])e.set(this._P.om,this._P.ze);t.cx.t=e.x,t.cy.t=e.y,t.bx.t=e.w/2,t.by.t=e.h/2,t.dark.t=0,t.k.t=10,t.cont.t=1}else this.retract()}}capsuleRect(){let e=this._w,t=e<600?e-44:Math.min(560,e*.62),n=e<600?50:56;return{x:e/2,y:Xt+(e<600?70:96),w:t,h:n}}retract(){var e;if(this.state===`RETRACT`)return;this.state=`RETRACT`;let t=this._sp;for(let e of[t.cx,t.cy,t.bx,t.by])e.set(this._P.om,this._P.ze);t.cy.t=Xt*.3,t.bx.t=t.by.t=1,t.dark.t=1,t.k.t=this._P.k,t.cont.t=0,(e=this.onCapsuleChange)==null||e.call(this,!1,{x:0,y:0,w:0,h:0})}get capsuleActive(){return this.state===`CAPSULE`}setParams(e){for(let t of Object.keys(e)){let n=e[t];typeof n==`number`&&isFinite(n)&&(this._P[t]=n)}e.k!=null&&this.state!==`CAPSULE`&&(this._sp.k.t=e.k)}start(){if(this._raf||!this._gl)return;this._last=performance.now();let e=t=>{this._killed||(this._tick(t),this._raf=requestAnimationFrame(e))};this._raf=requestAnimationFrame(e)}stop(){this._raf&&=(cancelAnimationFrame(this._raf),0)}kill(){this._killed=!0,this.stop();let e=this._gl;e&&(this._prog&&=(e.deleteProgram(this._prog),null),this._tex&&=(e.deleteTexture(this._tex),null))}_tick(e){var t;let n=this._gl,r=this._prog,i=this._canvas;if(!n||!r)return;let a=Math.min((e-this._last)/1e3,1/30);this._last=e;let o=this._sp,s=this._P;this.state===`DRAG`&&(o.cx.t=this.pointer.x,o.cy.t=Math.max(this.pointer.y,Xt*.5),o.bx.t=Zt+Math.min(26,Math.abs(o.cx.v)*.045),o.by.t=Zt+Math.min(26,Math.abs(o.cy.v)*.045));for(let e in o)o[e].step(a);this.state===`RETRACT`&&o.by.x<2.5&&(this.state=`IDLE`);let c=this._dpr;if(n.useProgram(r),n.uniform2f(this._U.uRes,i.width,i.height),n.uniform4f(this._U.uBlob,o.cx.x*c,o.cy.x*c,Math.max(o.bx.x,.5)*c,Math.max(o.by.x,.5)*c),n.uniform1f(this._U.uEdge,Xt*c),n.uniform1f(this._U.uK,o.k.x*c),n.uniform1f(this._U.uHeight,s.height*c),n.uniform1f(this._U.uRefract,s.refract*c),n.uniform1f(this._U.uHlAmt,s.hl),n.uniform1f(this._U.uAb,s.ab),n.uniform1f(this._U.uDpr,c),n.uniform1f(this._U.uDark,Math.max(0,Math.min(1,o.dark.x))),n.uniform1f(this._U.uCont,Math.max(0,Math.min(1,o.cont.x))*s.cont),n.uniform1f(this._U.uValid,this.state===`IDLE`?0:1),n.uniform1f(this._U.uHasTex,this._hasTex),n.uniform2f(this._U.uTexSize,this._texSize[0],this._texSize[1]),n.drawArrays(n.TRIANGLES,0,3),this.state===`CAPSULE`){let e={x:o.cx.x-o.bx.x,y:o.cy.x-o.by.x,w:o.bx.x*2,h:o.by.x*2};(t=this.onCapsuleChange)==null||t.call(this,!0,e)}}},en=`<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M12.8 12.8 17 17"/></svg>`,tn=`<svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="7.2" y="2.2" width="5.6" height="9.6" rx="2.8"/><path d="M4.6 9.6a5.4 5.4 0 0 0 10.8 0"/><path d="M10 15v2.6"/></svg>`,nn=class extends HTMLElement{constructor(){super(),n(this,`_canvas`),n(this,`_hint`),n(this,`_searchEl`),n(this,`_input`),n(this,`_caret`),n(this,`_runner`,null),n(this,`_ro`,null),n(this,`_w`,0),n(this,`_h`,0),n(this,`_disposed`,!1),n(this,`_mctx`,null),n(this,`_caretReset`,0),n(this,`_capsuleWas`,!1),n(this,`_inputFocused`,!1),n(this,`_onDown`,e=>{var t;let n=e.target;if(!(n&&n.closest&&n.closest(`#search`))){if(this._runner?.capsuleActive){this._runner.onDown(this._localPos(e).x,this._localPos(e).y);let t=this._localPos(e),n=this._runner.capsuleRect();if(Math.abs(t.x-n.x)<=n.w/2&&Math.abs(t.y-n.y)<=n.h/2)try{this._input.focus()}catch{}return}(t=this._runner)==null||t.onDown(this._localPos(e).x,this._localPos(e).y),this._hint.style.opacity=`0`;try{this._canvas.setPointerCapture(e.pointerId)}catch{}}}),n(this,`_onMove`,e=>{var t;let n=this._localPos(e);(t=this._runner)==null||t.onMove(n.x,n.y)}),n(this,`_onUp`,e=>{var t;if((t=this._runner)==null||t.onUp(),this._canvas.hasPointerCapture(e.pointerId))try{this._canvas.releasePointerCapture(e.pointerId)}catch{}}),n(this,`_onWinKey`,e=>{e.key===`Escape`&&this._runner?.capsuleActive&&this._runner.retract()}),n(this,`_onInput`,()=>{this._caret.style.animation=`none`,clearTimeout(this._caretReset),this._caretReset=window.setTimeout(()=>{this._caret.style.animation=``},80),this._updateCaret(!0),this.dispatchEvent(new CustomEvent(`lg-search`,{detail:{text:this._input.value},bubbles:!0}))}),n(this,`_onKey`,e=>{e.key===`Enter`&&this.dispatchEvent(new CustomEvent(`lg-search-submit`,{detail:{text:this._input.value},bubbles:!0}))}),n(this,`_onInputFocus`,()=>{this._inputFocused=!0,this._updateCaret(!0)}),n(this,`_onInputBlur`,()=>{this._inputFocused=!1,this._caret.style.display=`none`});let e=this.attachShadow({mode:`open`}),t=document.createElement(`style`);t.textContent=`:host{position:relative;display:block;overflow:hidden;background:#000;}canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab;}#hint{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);color:rgba(255,255,255,.5);font-size:14px;font-weight:600;pointer-events:none;transition:opacity .4s;font-family:-apple-system,system-ui,sans-serif;text-shadow:0 1px 6px rgba(0,0,0,.4);}#search{position:absolute;display:flex;align-items:center;opacity:0;pointer-events:none;transition:opacity .25s;box-sizing:border-box;}#search input{flex:1;min-width:0;height:100%;border:none;outline:none;background:transparent;font:400 17px/1 -apple-system,system-ui,"SF Pro Text",sans-serif;letter-spacing:.1px;color:#fff;caret-color:transparent;padding:0 10px;text-shadow:0 1px 5px rgba(0,0,0,.35);box-sizing:border-box;}#search input::placeholder{color:rgba(235,235,245,.45)}#search svg{flex:none;color:#fff;opacity:.72;filter:drop-shadow(0 1px 3px rgba(0,0,0,.3));}#search .ic{margin-left:20px}#search .mic{margin-right:20px}#caret{position:absolute;width:2px;height:21px;top:50%;transform:translateY(-50%);border-radius:1px;background:#fff;display:none;pointer-events:none;box-shadow:0 0 5px rgba(255,255,255,.95),0 0 14px rgba(255,255,255,.5);animation:lgc-blink 1.12s step-end infinite;}@keyframes lgc-blink{0%,60%{opacity:1}61%,100%{opacity:0}}@media (max-width:600px){#search input{font-size:16px;padding:0 8px}#search .ic{margin-left:14px}#search .mic{margin-right:14px}#caret{height:19px}}`,this._canvas=document.createElement(`canvas`),this._hint=document.createElement(`div`),this._hint.id=`hint`,this._searchEl=document.createElement(`div`),this._searchEl.id=`search`,this._input=document.createElement(`input`),this._caret=document.createElement(`span`),this._caret.id=`caret`,this._searchEl.innerHTML=en.replace(`<svg`,`<svg class="ic"`),this._input.setAttribute(`spellcheck`,`false`),this._input.setAttribute(`autocomplete`,`off`),this._searchEl.appendChild(this._input),this._searchEl.appendChild(this._caret),this._searchEl.insertAdjacentHTML(`beforeend`,tn.replace(`<svg`,`<svg class="ic mic"`)),e.appendChild(t),e.appendChild(this._canvas),e.appendChild(this._hint),e.appendChild(this._searchEl)}static get observedAttributes(){return[`wallpaper`,`dpr`,`placeholder`,`hint`]}connectedCallback(){if(this._runner)return;let e=new $t(this._canvas);this._runner=e;let t=window.devicePixelRatio||1,n=this.getAttribute(`dpr`);e.dpr=n?Math.max(.5,Math.min(t,parseFloat(n)||t,2)):Math.min(t,2);let r=this.getAttribute(`wallpaper`);r&&(e.wallpaper=r);let i=this.getAttribute(`placeholder`);i==null?this._input.placeholder=`Search or Ask`:this._input.placeholder=i;let a=this.getAttribute(`hint`);this._hint.textContent=a??`从顶部黑边往下拖拽`,e.onCapsuleChange=(e,t)=>{if(e){if(this._searchEl.style.left=t.x+`px`,this._searchEl.style.top=t.y+`px`,this._searchEl.style.width=t.w+`px`,this._searchEl.style.height=t.h+`px`,this._searchEl.style.opacity=`1`,this._searchEl.style.pointerEvents=`auto`,!this._capsuleWas){this._capsuleWas=!0;try{this._input.focus()}catch{}}this._updateCaret(!0)}else this._capsuleWas=!1,this._searchEl.style.opacity=`0`,this._searchEl.style.pointerEvents=`none`,this._caret.style.display=`none`},this._canvas.addEventListener(`pointerdown`,this._onDown),this._canvas.addEventListener(`pointermove`,this._onMove),this._canvas.addEventListener(`pointerup`,this._onUp),this._canvas.addEventListener(`pointercancel`,this._onUp),this._input.addEventListener(`input`,this._onInput),this._input.addEventListener(`keydown`,this._onKey),this._input.addEventListener(`focus`,this._onInputFocus),this._input.addEventListener(`blur`,this._onInputBlur),window.addEventListener(`keydown`,this._onWinKey);let o=new ResizeObserver(()=>this._resize());o.observe(this),this._ro=o,this._resize()}disconnectedCallback(){this._disposed=!0,this._ro&&this._ro.disconnect(),this._canvas.removeEventListener(`pointerdown`,this._onDown),this._canvas.removeEventListener(`pointermove`,this._onMove),this._canvas.removeEventListener(`pointerup`,this._onUp),this._canvas.removeEventListener(`pointercancel`,this._onUp),this._input.removeEventListener(`input`,this._onInput),this._input.removeEventListener(`keydown`,this._onKey),this._input.removeEventListener(`focus`,this._onInputFocus),this._input.removeEventListener(`blur`,this._onInputBlur),window.removeEventListener(`keydown`,this._onWinKey),this._runner&&=(this._runner.kill(),null)}attributeChangedCallback(e,t,n){if(this._runner){if(e===`wallpaper`)n&&(this._runner.wallpaper=n);else if(e===`dpr`){let e=parseFloat(n||`0`),t=window.devicePixelRatio||1;this._runner.dpr=e>0?Math.max(.5,Math.min(t,e,2)):Math.min(t,2),this._resize()}else e===`placeholder`?this._input.placeholder=n??`Search or Ask`:e===`hint`&&(this._hint.textContent=n??`从顶部黑边往下拖拽`,this._hint.style.opacity=n===``?`0`:``)}}_resize(){var e,t;let n=this.getBoundingClientRect();n.width&&n.height&&(this._w=n.width,this._h=n.height,this._canvas.style.width=n.width+`px`,this._canvas.style.height=n.height+`px`,(e=this._runner)==null||e.resize(n.width,n.height),(t=this._runner)==null||t.start())}_localPos(e){let t=this._canvas.getBoundingClientRect();return{x:e.clientX-t.left,y:e.clientY-t.top}}setParams(e){var t;(t=this._runner)==null||t.setParams(e)}getValue(){return this._input.value}setValue(e){this._input.value=e,this._updateCaret(!0),this.dispatchEvent(new CustomEvent(`lg-search`,{detail:{text:e},bubbles:!0}))}_updateCaret(e){if(!e||!this._inputFocused){this._caret.style.display=`none`;return}if(!this._mctx){let e=document.createElement(`canvas`);this._mctx=e.getContext(`2d`)}if(!this._mctx)return;let t=getComputedStyle(this._input);this._mctx.font=t.font;let n=parseFloat(t.paddingLeft)||0,r=this._input.value.slice(0,this._input.selectionStart??this._input.value.length),i=this._input.offsetLeft+n+this._mctx.measureText(r).width;this._caret.style.left=Math.min(i,this._input.offsetLeft+this._input.offsetWidth-12)+`px`,this._caret.style.display=`block`}};customElements.define(`liquid-glass-search`,nn);var rn={buttons:0,toggle:1,slider:3,"single-slider":4,"single-toggle":2,"bottom-tabs":5,"single-bottom-tabs":6,"toggle-card":7,"slider-card":8,"bottom-tabs-2":9,dialog:10,magnifier:11,"scroll-container":12,"lazy-scroll-container":13,rating:14,"rating-card":14,"ring-progress":15,"ring-progress-card":15,"siri-wave":16},an=Object.fromEntries(Object.entries(rn).map(([e,t])=>[t,e]));function on(e,t,n){let r=document.createElement(`canvas`);r.width=Math.max(2,t|0),r.height=Math.max(2,n|0);let i=r.getContext(`2d`),a=i.createLinearGradient(0,0,r.width,r.height);return e?(a.addColorStop(0,`#3f6fd6`),a.addColorStop(.45,`#7b5cff`),a.addColorStop(1,`#c44ad6`)):(a.addColorStop(0,`#0a1230`),a.addColorStop(.5,`#141a3a`),a.addColorStop(1,`#2a1240`)),i.fillStyle=a,i.fillRect(0,0,r.width,r.height),r.toDataURL()}var sn=class extends HTMLElement{constructor(){super(),n(this,`_canvas`),n(this,`_renderer`,null),n(this,`_siri`,null),n(this,`_state`),n(this,`_elements`,[]),n(this,`_interactions`,{}),n(this,`_gestures`,new Map),n(this,`_prevPinch`,null),n(this,`_w`,0),n(this,`_h`,0),n(this,`_dark`,!1),n(this,`_ro`,null),n(this,`_disposed`,!1),n(this,`_gradientLoaded`,!1),n(this,`_onWheel`),n(this,`_dbg`,null),n(this,`_tabsConfig`,null),n(this,`_buttonsConfig`,null),n(this,`_dialogConfig`,null),n(this,`_scrollConfig`,null),n(this,`_prevMode`,`bottom-tabs`),n(this,`_onNavigate`,e=>{let t=an[e]??`dest:`+e;this.dispatchEvent(new CustomEvent(`lg-navigate`,{detail:{dest:e,name:t},bubbles:!0}))}),n(this,`_onBack`,()=>{this.dispatchEvent(new CustomEvent(`lg-back`,{bubbles:!0}))}),n(this,`_onButtonTap`,e=>{this.dispatchEvent(new CustomEvent(`lg-buttontap`,{detail:{id:e},bubbles:!0}))}),n(this,`_onDialogTap`,e=>{this.dispatchEvent(new CustomEvent(`lg-dialogtap`,{detail:{action:e},bubbles:!0})),this.setAttribute(`mode`,this._prevMode||`bottom-tabs`),this._onBack()}),n(this,`_onLinkTap`,(e,t)=>{this.dispatchEvent(new CustomEvent(`lg-linktap`,{detail:{index:e,href:t},bubbles:!0}))}),n(this,`_onToggleTheme`,()=>{var e;this._dark=!this._dark,(e=this._renderer)==null||e.gooseBG(null),this._gradientLoaded=!1,this._maybeLoadGradient(),this._emitState(),this._rebuild()}),n(this,`_onDown`,e=>{let t=this._renderer;if(!t)return;let{x:n,y:r}=this._localPos(e),i=t.gooseGetScrollY(),a=this._elements,o=this._interactions,s=null;for(let e=a.length-1;e>=0;e--){let t=a[e],c=t.hitRect??t.rect,l=t.scroll?c.y-i:c.y,u=n,d=r,f=t.elementRotation;if(f&&Math.abs(f)>.001){let e=c.x+c.w*.5,a=(t.scroll?c.y-i:c.y)+c.h*.5,o=n-e,s=r-a,l=Math.cos(-f),p=Math.sin(-f);u=e+o*l-s*p,d=a+o*p+s*l}if(u>=c.x&&u<=c.x+c.w&&d>=l&&d<=l+c.h){if(!o?.[t.id]&&!t.isInteractive)continue;s=t;break}}if(s){let i=s.id,a=Array.from(this._gestures.entries()).find(([,e])=>e.pressedId===i&&e.mode!==`transform`);if(a&&o?.[i]?.onTransform){let[c,l]=a;s.isInteractive&&(s.kind===`button`||s.kind===`text`)&&t.goosePress(i,!1);let u={x:l.x,y:l.y},d={x:n,y:r},f=d.x-u.x,p=d.y-u.y;this._prevPinch={dist:Math.hypot(f,p),angle:Math.atan2(p,f),cx:(u.x+d.x)/2,cy:(u.y+d.y)/2},l.mode=`transform`,l.transformPartner=e.pointerId,this._gestures.set(e.pointerId,{pressedId:i,startX:n,startY:r,startClientY:e.clientY,startScrollY:t.gooseGetScrollY(),dragStarted:!1,mode:`transform`,hasDrag:!!o?.[i]?.onDrag,velocitySamples:[{t:performance.now(),x:e.clientX,y:e.clientY}],x:n,y:r,transformPartner:c});try{this._canvas.setPointerCapture(e.pointerId)}catch{}return}}let c=!!(s&&o?.[s.id]?.onDrag);if(this._dbg||={},this._dbg.downOnce||(this._dbg.downOnce=!0,console.log(`[lg-debug] down hitId=`,s?.id,`hasDrag=`,c)),this._gestures.set(e.pointerId,{pressedId:s?s.id:null,startX:n,startY:r,startClientY:e.clientY,startScrollY:t.gooseGetScrollY(),dragStarted:!1,mode:`pending`,hasDrag:c,velocitySamples:[{t:performance.now(),x:e.clientX,y:e.clientY}],x:n,y:r,transformPartner:null}),s&&s.isInteractive){let e=!!o?.[s.id]?.onDrag;(s.kind===`button`||s.kind===`text`||s.kind===`glass-shape`&&!e&&o?.[s.id]?.onTap)&&t.goosePress(s.id,!0,{x:n,y:r})}try{this._canvas.setPointerCapture(e.pointerId)}catch{}window.addEventListener(`pointermove`,this._onMove),window.addEventListener(`pointerup`,this._onUp),window.addEventListener(`pointercancel`,this._onUp)}),n(this,`_onMove`,e=>{var t,n,r,i,a,o;let s=this._renderer;if(!s)return;let{x:c,y:l}=this._localPos(e),u=this._gestures.get(e.pointerId);if(!u)return;if(u.x=c,u.y=l,u.mode===`transform`){let e=u.transformPartner;if(e==null)return;let r=this._gestures.get(e);if(!r)return;let i=u.pressedId;if(!i)return;let a=r.x-u.x,o=r.y-u.y,s=Math.hypot(a,o),c=Math.atan2(o,a),l=(u.x+r.x)/2,d=(u.y+r.y)/2,f=this._prevPinch;if(f&&f.dist>.001){let e=s/f.dist,r=c-f.angle;r>Math.PI&&(r-=2*Math.PI),r<-Math.PI&&(r+=2*Math.PI);let a={x:l-f.cx,y:d-f.cy};(n=(t=this._interactions?.[i])?.onTransform)==null||n.call(t,a,e,r)}this._prevPinch={dist:s,angle:c,cx:l,cy:d};return}u.velocitySamples.push({t:performance.now(),x:e.clientX,y:e.clientY}),u.velocitySamples.length>20&&u.velocitySamples.shift();let d=c-u.startX,f=l-u.startY,p=Math.abs(d),m=Math.abs(f);if(u.mode===`pending`){let t=u.pressedId;if(t){let e=this._elements.find(e=>e.id===t);e?.kind===`button`&&e.isInteractive&&s.gooseDragPos(t,{x:c,y:l})}if(p<4&&m<4)return;let n=u.pressedId,a=n?this._elements.find(e=>e.id===n):null,o=a?.kind===`button`&&a?.isInteractive,d=!!a&&!!this._interactions?.[n]?.onDrag;d&&!this._dbg?.dragOnce&&(this._dbg=this._dbg||{},this._dbg.dragOnce=!0,console.log(`[lg-debug] pending→drag id=`,n,`onDragType=`,typeof this._interactions?.[n]?.onDrag));let f=!d&&a?.kind===`glass-shape`&&a?.isInteractive&&!!this._interactions?.[n]?.onTap;if(d)u.mode=`drag`,u.dragStarted=!0,(i=(r=this._interactions?.[n])?.onDragStart)==null||i.call(r,{x:c,y:l});else if(o||f)s.gooseDragPos(n,{x:c,y:l});else if(m>p+2&&m>=14){if(Array.from(this._gestures.entries()).some(([t,n])=>t!==e.pointerId&&n.mode===`scroll`))return;if(n){let e=this._elements.find(e=>e.id===n);e?.isInteractive&&e.kind===`text`&&s.goosePress(n,!1)}u.mode=`scroll`;let t=e.clientY-u.startClientY;s.gooseScrollY(u.startScrollY-t);return}}if(u.mode===`scroll`){let t=e.clientY-u.startClientY;s.gooseScrollY(u.startScrollY-t);return}if(u.mode===`drag`){let e=u.pressedId;if(!e)return;let t=this._elements.find(t=>t.id===e);if(!t)return;t.kind===`button`&&t.isInteractive&&s.gooseDragPos(e,{x:c,y:l}),(o=(a=this._interactions?.[e])?.onDrag)==null||o.call(a,{x:c,y:l},{x:d,y:f})}}),n(this,`_onUp`,e=>{var t,n,r,i,a,o;let s=this._renderer,c=this._gestures.get(e.pointerId);if(!c){if(window.removeEventListener(`pointermove`,this._onMove),window.removeEventListener(`pointerup`,this._onUp),window.removeEventListener(`pointercancel`,this._onUp),this._canvas.hasPointerCapture(e.pointerId))try{this._canvas.releasePointerCapture(e.pointerId)}catch{}return}let l=c.mode,u=c.pressedId;if(l===`transform`){let r=c.transformPartner;if(this._gestures.delete(e.pointerId),this._prevPinch=null,r!=null){let e=this._gestures.get(r);e&&(e.transformPartner=null,e.mode=`drag`,e.dragStarted=!0,e.startX=e.x,e.startY=e.y,e.pressedId&&((n=(t=this._interactions?.[e.pressedId])?.onDragStart)==null||n.call(t,{x:e.x,y:e.y})))}if(this._canvas.hasPointerCapture(e.pointerId))try{this._canvas.releasePointerCapture(e.pointerId)}catch{}return}if(s){if(u){let e=this._elements.find(e=>e.id===u);if(e?.isInteractive){let t=!!this._interactions?.[u]?.onDrag;(e.kind===`button`||e.kind===`text`||e.kind===`glass-shape`&&!t&&this._interactions?.[u]?.onTap)&&s.goosePress(u,!1)}}if(l===`scroll`){let e=this._computeReleaseVelocity(c.velocitySamples);Math.abs(e)>50&&s.gooseScrollV(e)}if(u){let{x:t,y:n}=this._localPos(e);if(c.dragStarted){let{x:e,y:a}=this._computeReleaseVelocity2D(c.velocitySamples);(i=(r=this._interactions?.[u])?.onDragEnd)==null||i.call(r,{x:t,y:n},{x:e,y:a})}else(l===`pending`||l===`drag`)&&((o=(a=this._interactions?.[u])?.onTap)==null||o.call(a,{x:t,y:n}))}}if(window.removeEventListener(`pointermove`,this._onMove),window.removeEventListener(`pointerup`,this._onUp),window.removeEventListener(`pointercancel`,this._onUp),this._gestures.delete(e.pointerId),this._canvas.hasPointerCapture(e.pointerId))try{this._canvas.releasePointerCapture(e.pointerId)}catch{}}),this._state={...ot};let e=this.attachShadow({mode:`open`}),t=document.createElement(`style`);t.textContent=`:host{position:relative;display:block;overflow:hidden;}canvas{display:block;width:100%;height:100%;touch-action:none;cursor:pointer;}`,this._canvas=document.createElement(`canvas`),e.appendChild(t),e.appendChild(this._canvas)}static get observedAttributes(){return[`mode`,`dark`,`wallpaper`,`dpr`,`corner-style`,`blur-tap-cap`,`overlay-buttons`,`theme-button`,`tabs`,`buttons`,`dialog`,`scroll`,`variant`,`speed`,`scale`]}_isSiri(){return this._mode()===16}connectedCallback(){if(this._renderer||this._siri)return;this._dark=this.hasAttribute(`dark`);let e=this.hasAttribute(`overlay-buttons`);if(this._showThemeButton=this.hasAttribute(`theme-button`),this._state={...ot,hideOverlayButtons:!e},this._isSiri()){this._initSiri();return}let t=this.hasAttribute(`transparent-backdrop`)&&this._mode()===6,n=new W(this._canvas,{transparentBackdrop:t});this._renderer=n;let r=this.getAttribute(`dpr`);if(r!=null){let e=parseFloat(r),t=window.devicePixelRatio||1;n.dpr=e>0?Math.max(.5,Math.min(t,e)):t}let i=this.getAttribute(`blur-tap-cap`);i!=null&&(n.blurTapCap=Math.max(1,Math.min(33,parseInt(i)||17)));let a=this.getAttribute(`corner-style`);if(a!=null&&(n.cornerStyle=parseFloat(a)),this._mode(),t)n.gooseUseTransparentBackdrop(this._dark);else{n.gooseBG(null);let e=this.getAttribute(`wallpaper`);e&&e!==`gradient`&&n.gooseLoadWP(e).catch(e=>console.warn(`[liquid-glass] wallpaper load failed:`,e))}let o=new ResizeObserver(()=>this._resize());o.observe(this),this._ro=o,this._onWheel=e=>{e.preventDefault();let t=e.deltaY===0?e.deltaX:e.deltaY;n.gooseScrollY(n.gooseGetScrollY()+t)},this._canvas.addEventListener(`wheel`,this._onWheel,{passive:!1}),this._canvas.addEventListener(`pointerdown`,this._onDown),this._resize(),this._emitState()}disconnectedCallback(){this._disposed=!0,this._ro&&this._ro.disconnect(),this._canvas&&(this._canvas.removeEventListener(`wheel`,this._onWheel),this._canvas.removeEventListener(`pointerdown`,this._onDown),this._canvas.removeEventListener(`pointermove`,this._onMove),this._canvas.removeEventListener(`pointerup`,this._onUp),this._canvas.removeEventListener(`pointerleave`,this._onUp),this._canvas.removeEventListener(`pointercancel`,this._onUp)),this._siri&&=(this._siri.kill(),null),this._renderer&&=(this._renderer.gooseKill(),null)}attributeChangedCallback(e,t,n){if(!this._renderer&&!this._siri)return;if(e===`mode`){let e=(t||`bottom-tabs`).toLowerCase();if(e!==`dialog`&&(this._prevMode=e),this._isSiri())this._renderer&&(this._renderer.gooseKill(),this._renderer=null,this._canvas.removeEventListener(`wheel`,this._onWheel),this._canvas.removeEventListener(`pointerdown`,this._onDown)),this._initSiri();else if(this._siri){this._siri.kill(),this._siri=null;let e=this.hasAttribute(`transparent-backdrop`)&&this._mode()===6,t=new W(this._canvas,{transparentBackdrop:e});this._renderer=t;let n=this.getAttribute(`dpr`);if(n!=null){let e=parseFloat(n),r=window.devicePixelRatio||1;t.dpr=e>0?Math.max(.5,Math.min(r,e)):r}if(e)t.gooseUseTransparentBackdrop(this._dark);else{let e=this.getAttribute(`wallpaper`);e&&e!==`gradient`?t.gooseLoadWP(e).catch(()=>{}):this._maybeLoadGradient()}this._canvas.addEventListener(`wheel`,this._onWheel,{passive:!1}),this._canvas.addEventListener(`pointerdown`,this._onDown),t.gooseScrollY(0),this._rebuild()}else this._renderer.gooseScrollY(0),this._rebuild();return}if(this._isSiri()){if(e===`variant`)this._siri.variant=n===`orb`?`orb`:`wave`;else if(e===`speed`){let e=parseFloat(n||``);!isNaN(e)&&e>0&&(this._siri.speed=e)}else if(e===`scale`){let e=parseFloat(n||``);!isNaN(e)&&e>0&&(this._siri.scale=e)}else if(e===`dpr`){let e=parseFloat(n||`0`),t=window.devicePixelRatio||1;this._siri.dpr=e>0?Math.max(.5,Math.min(t,e)):t,this._resize()}return}let r=this._renderer;if(e===`dark`)this._dark=this.hasAttribute(`dark`),r.transparentBackdrop?r.gooseUseTransparentBackdrop(this._dark):r.gooseBG(null),this._gradientLoaded=!1,this._maybeLoadGradient(),this._rebuild(),this._emitState();else if(e===`wallpaper`){if(r.transparentBackdrop)return;this._gradientLoaded=!1,n&&n!==`gradient`?r.gooseLoadWP(n).catch(()=>{}):this._maybeLoadGradient()}else if(e===`dpr`){let e=parseFloat(n||`0`),t=window.devicePixelRatio||1;r.dpr=e>0?Math.max(.5,Math.min(t,e)):t,this._resize()}else if(e===`corner-style`)n!=null&&(r.cornerStyle=parseFloat(n),r.gooseReqRender());else if(e===`blur-tap-cap`)n!=null&&(r.blurTapCap=Math.max(1,Math.min(33,parseInt(n)||17)),r.gooseReqRender());else if(e===`overlay-buttons`)this._state={...this._state,hideOverlayButtons:!this.hasAttribute(`overlay-buttons`)},this._rebuild(),this._emitState();else if(e===`theme-button`)this._showThemeButton=this.hasAttribute(`theme-button`),this._rebuild(),this._emitState();else if(e===`tabs`){if(n)try{this._tabsConfig=JSON.parse(n)}catch{this._tabsConfig=null}else this._tabsConfig=null;this._rebuild()}else if(e===`buttons`){if(n)try{this._buttonsConfig=JSON.parse(n)}catch{this._buttonsConfig=null}else this._buttonsConfig=null;this._rebuild()}else if(e===`dialog`){if(n)try{this._dialogConfig=JSON.parse(n)}catch{this._dialogConfig=null}else this._dialogConfig=null;this._rebuild()}else if(e===`scroll`){if(n)try{this._scrollConfig=JSON.parse(n)}catch{this._scrollConfig=null}else this._scrollConfig=null;this._rebuild()}}_mode(){return rn[(this.getAttribute(`mode`)||`bottom-tabs`).toLowerCase()]??5}_initSiri(){if(this._siri)return;let e=new Gt(this._canvas);this._siri=e;let t=window.devicePixelRatio||1,n=this.getAttribute(`dpr`);e.dpr=n?Math.max(.5,Math.min(t,parseFloat(n)||t)):t,this.getAttribute(`variant`)===`orb`&&(e.variant=`orb`);let r=parseFloat(this.getAttribute(`speed`)||``);!isNaN(r)&&r>0&&(e.speed=r);let i=parseFloat(this.getAttribute(`scale`)||``);!isNaN(i)&&i>0&&(e.scale=i);let a=new ResizeObserver(()=>this._resize());a.observe(this),this._ro=a,this._resize()}_maybeLoadGradient(){var e,t;if(this._renderer?.transparentBackdrop)return;let n=this.getAttribute(`wallpaper`);if(!(this._w<=0||this._gradientLoaded)){if(n===`gradient`)this._gradientLoaded=!0,(e=this._renderer)==null||e.gooseLoadWP(on(!this._dark,this._w,this._h)).catch(()=>{});else if(!n){this._gradientLoaded=!0;let e=document.createElement(`canvas`);e.width=Math.max(2,this._w|0),e.height=Math.max(2,this._h|0),(t=this._renderer)==null||t.gooseLoadWP(e.toDataURL()).catch(()=>{})}}}_resize(){var e;let t=this.getBoundingClientRect();if(t.width&&t.height){if(this._w=t.width,this._h=t.height,this._canvas.style.width=t.width+`px`,this._canvas.style.height=t.height+`px`,this._siri){this._siri.resize(t.width,t.height),this._siri.start();return}(e=this._renderer)==null||e.gooseResize(t.width,t.height),this._maybeLoadGradient(),this._rebuild()}}_emitState(){this.dispatchEvent(new CustomEvent(`lg-statechange`,{detail:{...this._state,dark:this._dark},bubbles:!0}))}_setState(e){let t=typeof e==`function`?e(this._state):e;this._state={...this._state,...t},this._siri&&(t.variant!=null&&(this._siri.variant=t.variant),t.speed!=null&&t.speed>0&&(this._siri.speed=t.speed),t.scale!=null&&t.scale>0&&(this._siri.scale=t.scale)),this._emitState(),this._rebuild()}setState(e){this._setState(e)}setTabs(e){this._tabsConfig=e,this._rebuild()}setButtons(e){this._buttonsConfig=e,this._rebuild()}gooseButtons(e){this._buttonsConfig=e,this._rebuild()}setDialog(e){this._dialogConfig=e,this._rebuild()}setScroll(e){this._scrollConfig=e,this._rebuild()}_rebuild(){if(this._disposed)return;if(this._siri){this._siri.start();return}if(!this._renderer)return;let e=this._w,t=this._h;if(!e||!t)return;let n=Kt(this._mode(),e,t,this._state,e=>this._setState(e),this._onNavigate,this._onBack,this._renderer?{current:this._renderer}:void 0,!this._dark,this.hasAttribute(`overlay-buttons`)||this.hasAttribute(`theme-button`)?this._onToggleTheme:void 0,this._onButtonTap,this._tabsConfig,this._buttonsConfig,this._dialogConfig,this._onDialogTap,this._scrollConfig,this._onLinkTap);this._elements=n.elements,this._interactions=n.interactions,this._renderer.gooseElements(this._elements),this._renderer.gooseContentH(n.contentHeight),this._renderer.gooseReqRender(),this._syncTargets()}_syncTargets(){let e=this._renderer;if(!e)return;let t=(e,t)=>{if(!Ye.has(e))try{t()}catch{}};t(`toggle1`,()=>e.gooseTglTarget(`toggle1`,+!!this._state.toggleOn)),t(`toggle2`,()=>e.gooseTglTarget(`toggle2`,+!!this._state.toggleOn)),t(`tabs3`,()=>e.gooseTabSel(`tabs3`,this._state.selectedTab,this._tabsConfig?.[0]?.length??3)),t(`tabs4`,()=>e.gooseTabSel(`tabs4`,this._state.selectedTab2,this._tabsConfig?.[1]?.length??4)),t(`slider1`,()=>e.gooseTglTarget(`slider1`,this._state.sliderValue/100)),t(`slider2`,()=>e.gooseTglTarget(`slider2`,this._state.sliderValue/100))}_localPos(e){let t=this._canvas.getBoundingClientRect();return{x:e.clientX-t.left,y:e.clientY-t.top}}_computeReleaseVelocity(e){if(e.length<2)return 0;let t=e[e.length-1].t,n=t-100,r=e[e.length-1];for(let t=e.length-1;t>=0&&!(e[t].t<n);t--)r=e[t];let i=(t-r.t)/1e3;return i<.001?0:-(e[e.length-1].y-r.y)/i}_computeReleaseVelocity2D(e){if(e.length<2)return{x:0,y:0};let t=e[e.length-1],n=t.t,r=n-100,i=t;for(let t=e.length-1;t>=0&&!(e[t].t<r);t--)i=e[t];let a=(n-i.t)/1e3;return a<.001?{x:0,y:0}:{x:(t.x-i.x)/a,y:(t.y-i.y)/a}}};customElements.define(`liquid-glass`,sn)})();