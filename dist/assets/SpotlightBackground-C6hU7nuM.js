import{_ as re,o as oe,a as te,b as ne,c as ie,d as V,n as q,r as O}from"./index-DO70-BDy.js";const ae=.45,se=.8,le=1.6,ue=.9,ce=.6,fe=1e3/30,de=32e5,me="(max-width: 767px), (hover: none) and (pointer: coarse)",Y=`
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 rayPos;
uniform vec2 rayDir;
uniform vec3 raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2 mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float rayStrength(
  vec2 raySource,
  vec2 rayRefDirection,
  vec2 coord,
  float seedA,
  float seedB,
  float speed
) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float distortedAngle = cosAngle;
  if (distortion > 0.0) {
    distortedAngle += distortion
      * sin(iTime * 2.0 + length(sourceToCoord) * 0.01)
      * 0.2;
  }
  float spreadFactor = pow(
    max(distortedAngle, 0.0),
    1.0 / max(lightSpread, 0.001)
  );

  float distanceToSource = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp(
    (maxDistance - distanceToSource) / maxDistance,
    0.0,
    1.0
  );
  float fadeFalloff = clamp(
    (iResolution.x * fadeDistance - distanceToSource)
      / (iResolution.x * fadeDistance),
    0.5,
    1.0
  );
  float pulse = pulsating > 0.5
    ? (0.8 + 0.2 * sin(iTime * speed * 3.0))
    : 1.0;
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed))
      + (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0,
    1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

vec4 renderLightRays(vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 finalRayDir = rayDir;

  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) * rayStrength(
    rayPos,
    finalRayDir,
    coord,
    36.2214,
    21.11349,
    1.5 * raysSpeed
  );
  vec4 rays2 = vec4(1.0) * rayStrength(
    rayPos,
    finalRayDir,
    coord,
    22.3991,
    18.0234,
    1.1 * raysSpeed
  );
  vec4 color = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float noiseValue = noise(coord * 0.01 + iTime * 0.1);
    color.rgb *= 1.0 - noiseAmount + noiseAmount * noiseValue;
  }

  float brightness = 1.0 - coord.y / iResolution.y;
  color.r *= 0.1 + brightness * 0.8;
  color.g *= 0.3 + brightness * 0.6;
  color.b *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, saturation);
  }

  color.rgb *= raysColor;
  return color;
}
`,he={__name:"SpotlightBackground",setup(ge){const R=O(null),D=O(null),$=[212/255,226/255,241/255],l=O(!0);let g=0,k=0,_=0,F=0,S=0,e=null,t=null,u=null,o=null,p=!1,P=!1,m=null,h=null,C=null,B=null,A=!1,E=!1,x=!1;function b(){return!!(h?.matches||navigator.maxTouchPoints>0)}function G(r,f,n){const a=r.createShader(f);if(!a)throw new Error("无法创建 WebGL 着色器");if(r.shaderSource(a,n),r.compileShader(a),r.getShaderParameter(a,r.COMPILE_STATUS))return a;const d=r.getShaderInfoLog(a)||"未知着色器错误";throw r.deleteShader(a),new Error(d)}function Q(r){const n=p||!!r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.HIGH_FLOAT)?.precision?"highp":"mediump",a=p?`#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`:`attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`,d=p?`#version 300 es
precision ${n} float;
${Y}
out vec4 outColor;
void main() {
  outColor = renderLightRays(gl_FragCoord.xy);
}`:`precision ${n} float;
${Y}
void main() {
  gl_FragColor = renderLightRays(gl_FragCoord.xy);
}`,c=G(r,r.VERTEX_SHADER,a);let v=null;try{v=G(r,r.FRAGMENT_SHADER,d)}catch(L){throw r.deleteShader(c),L}const s=r.createProgram();if(!s)throw r.deleteShader(c),r.deleteShader(v),new Error("无法创建 WebGL 程序");if(r.attachShader(s,c),r.attachShader(s,v),r.linkProgram(s),r.deleteShader(c),r.deleteShader(v),r.getProgramParameter(s,r.LINK_STATUS))return s;const w=r.getProgramInfoLog(s)||"未知 WebGL 链接错误";throw r.deleteProgram(s),new Error(w)}function X(){!e||!t||!o||(e.useProgram(t),e.uniform3f(o.raysColor,...$),e.uniform1f(o.raysSpeed,ae),e.uniform1f(o.lightSpread,se),e.uniform1f(o.rayLength,le),e.uniform1f(o.pulsating,0),e.uniform1f(o.fadeDistance,ue),e.uniform1f(o.saturation,ce),e.uniform2f(o.mousePos,.5,.5),e.uniform1f(o.mouseInfluence,0),e.uniform1f(o.noiseAmount,0),e.uniform1f(o.distortion,0))}function W(){const r=R.value;if(!r||t||P||!x||b())return!!t;const f={alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,powerPreference:"low-power"};try{if(e=r.getContext("webgl",f),p=!1,e||(e=r.getContext("webgl2",f),p=!!e),!e)throw new Error("当前浏览器不支持 WebGL");if(t=Q(e),u=e.createBuffer(),!u)throw new Error("无法创建 WebGL 顶点缓冲区");e.bindBuffer(e.ARRAY_BUFFER,u),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);const n=e.getAttribLocation(t,"position");if(n<0)throw new Error("WebGL 顶点属性 position 不可用");return e.enableVertexAttribArray(n),e.vertexAttribPointer(n,2,e.FLOAT,!1,0,0),o=Object.fromEntries(["iTime","iResolution","rayPos","rayDir","raysColor","raysSpeed","lightSpread","rayLength","pulsating","fadeDistance","saturation","mousePos","mouseInfluence","noiseAmount","distortion"].map(d=>{const c=e.getUniformLocation(t,d);if(c===null)throw new Error(`WebGL uniform ${d} 不可用`);return[d,c]})),e.disable(e.DEPTH_TEST),e.disable(e.CULL_FACE),e.clearColor(0,0,0,0),X(),M(),l.value=!1,!0}catch(n){return e&&u&&e.deleteBuffer(u),e&&t&&e.deleteProgram(t),e=null,t=null,u=null,o=null,P=!0,l.value=!0,console.warn("WebGL 光束背景初始化失败：",n),!1}}function M(){const r=R.value;if(!r||!e||!t||!o)return;const f=Math.max(1,Math.round(r.clientWidth||window.innerWidth)),n=Math.max(1,Math.round(r.clientHeight||window.innerHeight)),a=Math.min(window.devicePixelRatio||1,2),d=Math.sqrt(de/Math.max(1,f*n)),c=Math.min(a,d),v=Math.max(1,Math.round(f*c)),s=Math.max(1,Math.round(n*c));(r.width!==v||r.height!==s)&&(r.width=v,r.height=s);const w=e.drawingBufferWidth,L=e.drawingBufferHeight;e.viewport(0,0,w,L),e.useProgram(t),e.uniform2f(o.iResolution,w,L),e.uniform2f(o.rayPos,w*.5,L*-.2),e.uniform2f(o.rayDir,0,1)}function T(r=0){!e||!t||!o||(e.useProgram(t),e.uniform1f(o.iTime,r*.001),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLES,0,3))}function H(r){if(!A||E||document.hidden||b()||!t){g=0;return}r-k>=fe&&(T(r),k=r),g=requestAnimationFrame(H)}function j(){g||!A||E||document.hidden||b()||!t||(g=requestAnimationFrame(H))}function y(){g&&cancelAnimationFrame(g),g=0}function K(){e&&e.clear(e.COLOR_BUFFER_BIT)}function i(){if(A=document.documentElement.classList.contains("dark"),E=!!m?.matches,!A){y(),K();return}if(b()){y(),l.value=!0;return}if(!x){l.value=!0;return}if(W()){if(l.value=!1,M(),E){y(),T(0);return}T(performance.now()),j()}}function J(){!A||b()||!W()||(M(),T(E?0:performance.now()))}function I(){S||(S=requestAnimationFrame(()=>{S=0,J()}))}function Z(){_=requestAnimationFrame(()=>{_=0,F=requestAnimationFrame(()=>{F=0,x=!0,i()})})}function N(){document.hidden?y():i()}function z(r){r.preventDefault(),y(),e=null,t=null,u=null,o=null,P=!0,l.value=!0}function U(){l.value=!0}function ee(){y(),e&&u&&e.deleteBuffer(u),e&&t&&e.deleteProgram(t),e?.getExtension("WEBGL_lose_context")?.loseContext(),e=null,t=null,u=null,o=null,p=!1,P=!1,l.value=!0}return oe(()=>{const r=R.value;m=window.matchMedia("(prefers-reduced-motion: reduce)"),h=window.matchMedia(me),m.addEventListener?m.addEventListener("change",i):m.addListener?.(i),h.addEventListener?h.addEventListener("change",i):h.addListener?.(i),C=new MutationObserver(i),C.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),B=typeof ResizeObserver>"u"?null:new ResizeObserver(I),r&&(r.addEventListener("webglcontextlost",z),r.addEventListener("webglcontextrestored",U)),D.value&&B?.observe(D.value),window.addEventListener("resize",I,{passive:!0}),document.addEventListener("visibilitychange",N),i(),Z()}),te(()=>{const r=R.value;m?.removeEventListener?m.removeEventListener("change",i):m?.removeListener?.(i),h?.removeEventListener?h.removeEventListener("change",i):h?.removeListener?.(i),C?.disconnect(),B?.disconnect(),window.removeEventListener("resize",I),document.removeEventListener("visibilitychange",N),r?.removeEventListener("webglcontextlost",z),r?.removeEventListener("webglcontextrestored",U),_&&cancelAnimationFrame(_),F&&cancelAnimationFrame(F),S&&cancelAnimationFrame(S),ee()}),(r,f)=>(ne(),ie("div",{ref_key:"hostRef",ref:D,class:"pointer-events-none fixed inset-0 z-[1] overflow-hidden opacity-0 transition-opacity duration-500 dark:opacity-[.62]","aria-hidden":"true","data-light-rays-background":""},[V("div",{class:q(["light-rays-fallback absolute inset-0 transition-opacity duration-500",l.value?"opacity-100":"opacity-0"])},null,2),V("canvas",{ref_key:"canvasRef",ref:R,class:q(["absolute inset-0 block h-full w-full transition-opacity duration-300",l.value?"opacity-0":"opacity-100"]),"data-light-rays-canvas":""},null,2)],512))}},pe=re(he,[["__scopeId","data-v-2ff8ccd2"]]);export{pe as default};
