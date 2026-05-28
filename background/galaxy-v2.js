(function () {
  var allowedHostnames = window.SuperGalaxyAllowedHostnames || [];

  if (typeof allowedHostnames === "string") {
    allowedHostnames = [allowedHostnames];
  }

  allowedHostnames = allowedHostnames.map(function (hostname) {
    return String(hostname)
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
  });

if (!allowedHostnames.includes(window.location.hostname)) return;
  if (window.self !== window.top) return;
  if (window.location.hostname === "app.super.so") return;
  if (document.referrer && document.referrer.indexOf("app.super.so") !== -1) return;

  if (window.__SUPER_REACTBITS_GALAXY__) return;
  window.__SUPER_REACTBITS_GALAXY__ = true;

  function startGalaxy() {
    if (!document.body) return;
    if (document.getElementById("super-reactbits-galaxy-bg")) return;

    var style = document.createElement("style");
    style.id = "super-reactbits-galaxy-style";
    style.textContent = `
      html,
      body {
        background: #030712 !important;
      }

      #super-reactbits-galaxy-bg {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        overflow: hidden !important;
        pointer-events: auto !important;
        z-index: 0 !important;
        background:
          radial-gradient(circle at 50% 50%, rgba(58, 24, 122, 0.25), transparent 38%),
          radial-gradient(circle at 20% 20%, rgba(6, 182, 212, 0.08), transparent 30%),
          #030712 !important;
      }

      #super-reactbits-galaxy-bg canvas {
        width: 100% !important;
        height: 100% !important;
        display: block !important;
      }

      .super-navbar,
      .super-content,
      .super-content-wrapper,
      .notion-root,
      .notion-page,
      .super-footer {
        position: relative !important;
        z-index: 1 !important;
      }

      .super-content,
      .super-content-wrapper,
      .notion-root,
      .notion-page {
        background: transparent !important;
      }

      @media (max-width: 767px) {
        #super-reactbits-galaxy-bg canvas {
          opacity: 0.85 !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #super-reactbits-galaxy-bg canvas {
          opacity: 0.55 !important;
        }
      }
    `;
    document.head.appendChild(style);

    var wrapper = document.createElement("div");
    wrapper.id = "super-reactbits-galaxy-bg";

    var canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    document.body.prepend(wrapper);

    var gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false
    });

    if (!gl) {
      wrapper.style.background =
        "radial-gradient(circle at 50% 50%, rgba(147, 51, 234, 0.45), transparent 32%), radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.16), transparent 12%), #030712";
      return;
    }

    /*
      Main settings.
      These match the ReactBits Galaxy concept:
      density = more/fewer stars
      starSpeed = star travel speed
      hueShift = star color shift
      saturation = 0 is mostly white stars, higher adds color
      mouseRepulsion = stars move away from cursor
      transparent = shows only stars over the CSS background
    */
    var settings = {
      focal: [0.5, 0.5],
      rotation: [1.0, 0.0],
      starSpeed: 0.5,
      density: 2.0,
      hueShift: 140,
      speed: 1.0,
      mouseInteraction: true,
      glowIntensity: 0.35,
      saturation: 0.15,
      mouseRepulsion: true,
      repulsionStrength: 2.0,
      twinkleIntensity: 0.35,
      rotationSpeed: 0.1,
      autoCenterRepulsion: 0.0,
      transparent: true
    };

    var vertexShaderSource = `
      attribute vec2 uv;
      attribute vec2 position;

      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    var fragmentShaderSource = `
      precision highp float;

      uniform float uTime;
      uniform vec3 uResolution;
      uniform vec2 uFocal;
      uniform vec2 uRotation;
      uniform float uStarSpeed;
      uniform float uDensity;
      uniform float uHueShift;
      uniform float uSpeed;
      uniform vec2 uMouse;
      uniform float uGlowIntensity;
      uniform float uSaturation;
      uniform bool uMouseRepulsion;
      uniform float uTwinkleIntensity;
      uniform float uRotationSpeed;
      uniform float uRepulsionStrength;
      uniform float uMouseActiveFactor;
      uniform float uAutoCenterRepulsion;
      uniform bool uTransparent;

      varying vec2 vUv;

      #define NUM_LAYER 4.0
      #define STAR_COLOR_CUTOFF 0.2
      #define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
      #define PERIOD 3.0

      float Hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float tri(float x) {
        return abs(fract(x) * 2.0 - 1.0);
      }

      float tris(float x) {
        float t = fract(x);
        return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
      }

      float trisn(float x) {
        float t = fract(x);
        return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
      }

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      float Star(vec2 uv, float flare) {
        float d = length(uv);
        float m = (0.05 * uGlowIntensity) / d;

        float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
        m += rays * flare * uGlowIntensity;

        uv *= MAT45;

        rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
        m += rays * 0.3 * flare * uGlowIntensity;

        m *= smoothstep(1.0, 0.2, d);

        return m;
      }

      vec3 StarLayer(vec2 uv) {
        vec3 col = vec3(0.0);
        vec2 gv = fract(uv) - 0.5;
        vec2 id = floor(uv);

        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 si = id + vec2(float(x), float(y));

            float seed = Hash21(si);
            float size = fract(seed * 345.32);
            float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
            float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

            float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
            float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
            float grn = min(red, blu) * seed;

            vec3 base = vec3(red, grn, blu);

            float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
            hue = fract(hue + uHueShift / 360.0);

            float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
            float val = max(max(base.r, base.g), base.b);

            base = hsv2rgb(vec3(hue, sat, val));

            vec2 pad = vec2(
              tris(seed * 34.0 + uTime * uSpeed / 10.0),
              tris(seed * 38.0 + uTime * uSpeed / 30.0)
            ) - 0.5;

            float star = Star(gv - offset - pad, flareSize);

            float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
            twinkle = mix(1.0, twinkle, uTwinkleIntensity);

            star *= twinkle;

            col += star * size * base;
          }
        }

        return col;
      }

      void main() {
        vec2 focalPx = uFocal * uResolution.xy;
        vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

        vec2 mouseNorm = uMouse - vec2(0.5);

        if (uAutoCenterRepulsion > 0.0) {
          vec2 centerUV = vec2(0.0, 0.0);
          float centerDist = length(uv - centerUV);
          vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));
          uv += repulsion * 0.05;
        } else if (uMouseRepulsion) {
          vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
          float mouseDist = length(uv - mousePosUV);
          vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
          uv += repulsion * 0.05 * uMouseActiveFactor;
        } else {
          vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
          uv += mouseOffset;
        }

        float autoRotAngle = uTime * uRotationSpeed;
        mat2 autoRot = mat2(
          cos(autoRotAngle), -sin(autoRotAngle),
          sin(autoRotAngle), cos(autoRotAngle)
        );

        uv = autoRot * uv;
        uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

        vec3 col = vec3(0.0);

        for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
          float depth = fract(i + uStarSpeed * uSpeed);
          float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
          float fade = depth * smoothstep(1.0, 0.9, depth);

          col += StarLayer(uv * scale + i * 453.32) * fade;
        }

        if (uTransparent) {
          float alpha = length(col);
          alpha = smoothstep(0.0, 0.3, alpha);
          alpha = min(alpha, 1.0);

          gl_FragColor = vec4(col, alpha);
        } else {
          gl_FragColor = vec4(col, 1.0);
        }
      }
    `;

    function createShader(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Galaxy shader error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    }

    var vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    var fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) return;

    var program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Galaxy program error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    var positions = new Float32Array([
      -1, -1,
       3, -1,
      -1,  3
    ]);

    var uvs = new Float32Array([
      0, 0,
      2, 0,
      0, 2
    ]);

    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    var positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    var uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    var uvLocation = gl.getAttribLocation(program, "uv");
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);

    var uniforms = {
      uTime: gl.getUniformLocation(program, "uTime"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uFocal: gl.getUniformLocation(program, "uFocal"),
      uRotation: gl.getUniformLocation(program, "uRotation"),
      uStarSpeed: gl.getUniformLocation(program, "uStarSpeed"),
      uDensity: gl.getUniformLocation(program, "uDensity"),
      uHueShift: gl.getUniformLocation(program, "uHueShift"),
      uSpeed: gl.getUniformLocation(program, "uSpeed"),
      uMouse: gl.getUniformLocation(program, "uMouse"),
      uGlowIntensity: gl.getUniformLocation(program, "uGlowIntensity"),
      uSaturation: gl.getUniformLocation(program, "uSaturation"),
      uMouseRepulsion: gl.getUniformLocation(program, "uMouseRepulsion"),
      uTwinkleIntensity: gl.getUniformLocation(program, "uTwinkleIntensity"),
      uRotationSpeed: gl.getUniformLocation(program, "uRotationSpeed"),
      uRepulsionStrength: gl.getUniformLocation(program, "uRepulsionStrength"),
      uMouseActiveFactor: gl.getUniformLocation(program, "uMouseActiveFactor"),
      uAutoCenterRepulsion: gl.getUniformLocation(program, "uAutoCenterRepulsion"),
      uTransparent: gl.getUniformLocation(program, "uTransparent")
    };

    var targetMouse = { x: 0.5, y: 0.5 };
    var smoothMouse = { x: 0.5, y: 0.5 };
    var targetMouseActive = 0.0;
    var smoothMouseActive = 0.0;

    function resizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var width = window.innerWidth;
      var height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function handleMouseMove(event) {
      var rect = wrapper.getBoundingClientRect();

      targetMouse.x = (event.clientX - rect.left) / rect.width;
      targetMouse.y = 1.0 - (event.clientY - rect.top) / rect.height;
      targetMouseActive = 1.0;
    }

    function handleMouseLeave() {
      targetMouseActive = 0.0;
    }

    function handleTouchMove(event) {
      if (!event.touches || !event.touches.length) return;

      var rect = wrapper.getBoundingClientRect();
      var touch = event.touches[0];

      targetMouse.x = (touch.clientX - rect.left) / rect.width;
      targetMouse.y = 1.0 - (touch.clientY - rect.top) / rect.height;
      targetMouseActive = 1.0;
    }

    if (settings.transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(0, 0, 0, 1);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    if (settings.mouseInteraction) {
      wrapper.addEventListener("mousemove", handleMouseMove, { passive: true });
      wrapper.addEventListener("mouseleave", handleMouseLeave, { passive: true });
      wrapper.addEventListener("touchmove", handleTouchMove, { passive: true });
      wrapper.addEventListener("touchend", handleMouseLeave, { passive: true });
    }

    var startTime = performance.now();

    function render(now) {
      var elapsed = (now - startTime) * 0.001;

      smoothMouse.x += (targetMouse.x - smoothMouse.x) * 0.05;
      smoothMouse.y += (targetMouse.y - smoothMouse.y) * 0.05;
      smoothMouseActive += (targetMouseActive - smoothMouseActive) * 0.05;

      gl.useProgram(program);

      if (settings.transparent) {
        gl.clearColor(0, 0, 0, 0);
      } else {
        gl.clearColor(0, 0, 0, 1);
      }

      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uniforms.uTime, elapsed);
      gl.uniform3f(uniforms.uResolution, canvas.width, canvas.height, canvas.width / canvas.height);
      gl.uniform2f(uniforms.uFocal, settings.focal[0], settings.focal[1]);
      gl.uniform2f(uniforms.uRotation, settings.rotation[0], settings.rotation[1]);
      gl.uniform1f(uniforms.uStarSpeed, (elapsed * settings.starSpeed) / 10.0);
      gl.uniform1f(uniforms.uDensity, settings.density);
      gl.uniform1f(uniforms.uHueShift, settings.hueShift);
      gl.uniform1f(uniforms.uSpeed, settings.speed);
      gl.uniform2f(uniforms.uMouse, smoothMouse.x, smoothMouse.y);
      gl.uniform1f(uniforms.uGlowIntensity, settings.glowIntensity);
      gl.uniform1f(uniforms.uSaturation, settings.saturation);
      gl.uniform1i(uniforms.uMouseRepulsion, settings.mouseRepulsion ? 1 : 0);
      gl.uniform1f(uniforms.uTwinkleIntensity, settings.twinkleIntensity);
      gl.uniform1f(uniforms.uRotationSpeed, settings.rotationSpeed);
      gl.uniform1f(uniforms.uRepulsionStrength, settings.repulsionStrength);
      gl.uniform1f(uniforms.uMouseActiveFactor, smoothMouseActive);
      gl.uniform1f(uniforms.uAutoCenterRepulsion, settings.autoCenterRepulsion);
      gl.uniform1i(uniforms.uTransparent, settings.transparent ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGalaxy);
  } else {
    startGalaxy();
  }
})();
