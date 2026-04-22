// Run once with: node generate-icons.js
// Requires: npm install canvas
const { createCanvas } = require("canvas");
const fs = require("fs");

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const r = size * 0.12;

  // Background
  ctx.fillStyle = "#0a2540";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();

  // Letter S
  ctx.fillStyle = "#00c48c";
  ctx.font = `bold ${size * 0.55}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("S", size / 2, size / 2);

  fs.writeFileSync(`icons/icon-${size}.png`, canvas.toBuffer("image/png"));
  console.log(`icons/icon-${size}.png created`);
}

makeIcon(192);
makeIcon(512);
