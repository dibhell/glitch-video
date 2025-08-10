import React, { useEffect, useRef, useState } from "react";

// Audio‑reactive glitch/distortion video generator (single-file React component)
// (Shortened header) — embedded for Vite demo

function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + info);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("Program link error: " + info);
  }
  return program;
}

const VERT = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_uv;
void main(){
  v_uv = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform sampler2D u_prevTex;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dryWet; uniform float u_amount; uniform float u_glitch; uniform float u_audio;
uniform float u_effect; uniform float u_psy; uniform float u_bump; uniform float u_lightAng;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec3 hueRotate(vec3 c, float a){
  const mat3 toYIQ = mat3(0.299,0.587,0.114, 0.596,-0.274,-0.322, 0.211,-0.523,0.312);
  const mat3 toRGB = mat3(1.0,0.956,0.621, 1.0,-0.272,-0.647, 1.0,-1.106,1.703);
  vec3 yiq = toYIQ * c; float h = atan(yiq.z, yiq.y) + a; float len = length(yiq.yz);
  yiq.y = cos(h) * len; yiq.z = sin(h) * len; return clamp(toRGB * yiq, 0.0, 1.0);
}
vec3 filmGrain(vec2 uv, float t){ float n = hash(uv * (t*0.1+1.0)); return vec3(n*0.12); }
vec3 chromaSplit(sampler2D tex, vec2 uv, vec2 dir, float amount){
  vec2 o = dir * amount; vec3 col;
  col.r = texture2D(tex, uv + o).r; col.g = texture2D(tex, uv).g; col.b = texture2D(tex, uv - o).b; return col;
}
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

void main(){
  vec2 uv = v_uv; vec2 res = u_resolution; float time = u_time;
  vec3 baseCol = texture2D(u_tex, uv).rgb;
  vec3 col = baseCol;
  float m = floor(u_effect + 0.5);
  if (m < 0.5) {
    float px = mix(1.0, 120.0, clamp(u_amount*0.85 + u_audio*0.25, 0.0, 1.0));
    vec2 uvPix = floor(uv * px) / px;
    float lines = mix(40.0, 400.0, u_glitch);
    float linePhase = fract(uv.y * lines + time * (2.0 + u_audio*6.0));
    float tear = step(linePhase, u_glitch * 0.7 + u_audio * 0.5);
    float randShift = (hash(vec2(uv.y*100.0, time)) - 0.5) * (0.06 * (u_glitch + u_audio));
    vec2 uvGlitch = uvPix + vec2(tear * randShift, 0.0);
    float w = (u_amount*0.8 + u_audio*0.6);
    uvGlitch.x += 0.015 * w * sin(uvGlitch.y*20.0 + time*2.5);
    uvGlitch.y += 0.010 * w * cos(uvGlitch.x*18.0 + time*2.0);
    float off = 0.007 * (u_amount*0.7 + u_audio*0.5);
    vec2 dir = normalize(vec2(0.8, 0.6));
    col = vec3(
      texture2D(u_tex, uvGlitch + dir*off).r,
      texture2D(u_tex, uvGlitch).g,
      texture2D(u_tex, uvGlitch - dir*off).b
    ) + filmGrain(uv+time, time);
  } else if (m < 1.5) {
    vec2 p = uv*2.0 - 1.0; float r = length(p); float a = atan(p.y,p.x);
    float warp = (sin(r*12.0 - time*3.0) + cos((r+time*0.5)*9.0)) * (0.25*u_psy + 0.25*u_audio);
    a += warp + 0.35*u_amount; r += 0.12 * sin(a*8.0 + time*2.5) * (u_psy + u_audio);
    vec2 uv2 = vec2(cos(a), sin(a)) * r * 0.5 + 0.5; uv2 = abs(fract(uv2*vec2(2.0)) - 0.5);
    float off = 0.015 * (u_psy + u_audio); vec2 dir = vec2(cos(time*0.7), sin(time*0.7));
    col = vec3(
      texture2D(u_tex, uv2 + dir*off).r,
      texture2D(u_tex, uv2).g,
      texture2D(u_tex, uv2 - dir*off).b
    );
  } else {
    col = baseCol;
  }
  vec3 outCol = mix(baseCol, col, clamp(u_dryWet,0.0,1.0));
  gl_FragColor = vec4(outCol, 1.0);
}
`;

export default function App(){
  const canvasRef = React.useRef(null);
  const glRef = React.useRef(null);
  const videoRef = React.useRef(null);
  const [hasWebGL, setHasWebGL] = React.useState(true);
  const [dryWet, setDryWet] = React.useState(0.75);
  const [amount, setAmount] = React.useState(0.6);
  const [glitch, setGlitch] = React.useState(0.35);
  const [effect, setEffect] = React.useState(0);

  const [audioLevel, setAudioLevel] = React.useState(0);
  const audioCtxRef = React.useRef(null);
  const analyserRef = React.useRef(null);
  const mediaKindRef = React.useRef("none");
  const texRef = React.useRef(null);
  const prevTexRef = React.useRef(null);
  const programRef = React.useRef(null);
  const uniformsRef = React.useRef({});
  const rafRef = React.useRef(0);
  const startTimeRef = React.useRef(performance.now());

  React.useEffect(()=>{
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl){ setHasWebGL(false); return; }
    glRef.current = gl;
    const program = createProgram(gl, VERT, FRAG);
    programRef.current = program;
    gl.useProgram(program);

    const pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uv = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uv);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1]), gl.STATIC_DRAW);
    const aUV = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texRef.current = tex;

    const prev = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, prev);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    prevTexRef.current = prev;

    uniformsRef.current = {
      u_tex: gl.getUniformLocation(program, 'u_tex'),
      u_prevTex: gl.getUniformLocation(program, 'u_prevTex'),
      u_resolution: gl.getUniformLocation(program, 'u_resolution'),
      u_time: gl.getUniformLocation(program, 'u_time'),
      u_dryWet: gl.getUniformLocation(program, 'u_dryWet'),
      u_amount: gl.getUniformLocation(program, 'u_amount'),
      u_glitch: gl.getUniformLocation(program, 'u_glitch'),
      u_audio: gl.getUniformLocation(program, 'u_audio'),
      u_effect: gl.getUniformLocation(program, 'u_effect'),
      u_psy: gl.getUniformLocation(program, 'u_psy'),
      u_bump: gl.getUniformLocation(program, 'u_bump'),
      u_lightAng: gl.getUniformLocation(program, 'u_lightAng'),
    };
    gl.useProgram(program);
    gl.uniform1i(uniformsRef.current.u_tex, 0);
    gl.uniform1i(uniformsRef.current.u_prevTex, 1);

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor((canvas.clientWidth || 960) * dpr);
      const h = Math.floor((canvas.clientHeight || 540) * dpr);
      canvas.width = w; canvas.height = h;
      gl.viewport(0,0,w,h);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, prevTexRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.activeTexture(gl.TEXTURE0);
    };
    handleResize(); window.addEventListener('resize', handleResize);

    const draw = () => {
      const timeSec = (performance.now() - startTimeRef.current) / 1000;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texRef.current);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prevTexRef.current);
      gl.activeTexture(gl.TEXTURE0);
      const canvasW = canvas.width, canvasH = canvas.height;
      const blank = new Uint8Array(canvasW*canvasH*4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasW, canvasH, 0, gl.RGBA, gl.UNSIGNED_BYTE, blank);

      gl.useProgram(programRef.current);
      gl.uniform2f(uniformsRef.current.u_resolution, canvasW, canvasH);
      gl.uniform1f(uniformsRef.current.u_time, timeSec);
      gl.uniform1f(uniformsRef.current.u_dryWet, dryWet);
      gl.uniform1f(uniformsRef.current.u_amount, amount);
      gl.uniform1f(uniformsRef.current.u_glitch, glitch);
      gl.uniform1f(uniformsRef.current.u_audio, audioLevel);
      gl.uniform1f(uniformsRef.current.u_effect, effect);
      gl.uniform1f(uniformsRef.current.u_psy, 0.7);
      gl.uniform1f(uniformsRef.current.u_bump, 0.6);
      gl.uniform1f(uniformsRef.current.u_lightAng, 0.6);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindTexture(gl.TEXTURE_2D, prevTexRef.current);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, canvasW, canvasH);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(rafRef.current); };
  }, [dryWet, amount, glitch, effect, audioLevel]);

  // simple audio level meter (mic) to demonstrate animation without loading files
  React.useEffect(()=>{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;
    navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(buf);
        let sum=0; for (let i=0;i<buf.length;i++){ const x=(buf[i]-128)/128; sum+=x*x; }
        const rms = Math.sqrt(sum/buf.length);
        setAudioLevel(Math.min(1, rms*3));
        requestAnimationFrame(loop);
      };
      loop();
    }).catch(()=>{});
  }, []);

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-4">
      <h1 className="text-xl font-semibold mb-3">Glitch Video — Vite demo</h1>
      <div className="grid md:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-3 bg-neutral-900/50 rounded-xl p-3">
          <div>
            <label className="text-sm flex justify-between"><span>Dry/Wet</span><span>{dryWet.toFixed(2)}</span></label>
            <input type="range" min={0} max={1} step={0.01} value={dryWet} onChange={e=>setDryWet(parseFloat(e.target.value))} className="w-full"/>
          </div>
          <div>
            <label className="text-sm flex justify-between"><span>Amount</span><span>{amount.toFixed(2)}</span></label>
            <input type="range" min={0} max={1} step={0.01} value={amount} onChange={e=>setAmount(parseFloat(e.target.value))} className="w-full"/>
          </div>
          <div>
            <label className="text-sm flex justify-between"><span>Glitch</span><span>{glitch.toFixed(2)}</span></label>
            <input type="range" min={0} max={1} step={0.01} value={glitch} onChange={e=>setGlitch(parseFloat(e.target.value))} className="w-full"/>
          </div>
          <div>
            <label className="text-sm flex justify-between"><span>Effect</span><span>{effect}</span></label>
            <input type="range" min={0} max={2} step={1} value={effect} onChange={e=>setEffect(parseInt(e.target.value))} className="w-full"/>
          </div>
          <div className="text-xs opacity-70">Live audio level: {(audioLevel*100|0)}%</div>
          <div className="w-full h-2 bg-neutral-800 rounded overflow-hidden"><div style={{width: `${Math.min(100, audioLevel*100)}%`}} className="h-2 bg-emerald-500"></div></div>
        </div>
        <div className="bg-black rounded-xl overflow-hidden min-h-[360px]">
          <canvas ref={canvasRef} className="w-full h-[60vh] block" />
        </div>
      </div>
      <p className="text-xs opacity-70 mt-3">This is a minimal demo. Your full component is richer; use this repo only to build the Android APK via GitHub Actions.</p>
    </div>
  )
}
