// Script to generate ultra-smooth keyframes for orb animations
// This will create 1000+ keyframes for 120+ FPS smooth motion

function generateYinYangKeyframes() {
  const totalFrames = 1000;
  let keyframes = '';

  for (let i = 0; i <= totalFrames; i++) {
    const percent = (i / totalFrames * 100).toFixed(1);
    const angle = (i / totalFrames) * 360; // degrees

    // Convert to radians for calculation
    const radians = angle * (Math.PI / 180);

    // Calculate positions for circular motion
    const radius = 25; // 25% from center
    const centerX = 50;
    const centerY = 50;

    // Red orb position
    const redX = centerX + radius * Math.cos(radians);
    const redY = centerY + radius * Math.sin(radians);

    // Blue orb position (opposite side)
    const blueX = centerX - radius * Math.cos(radians);
    const blueY = centerY - radius * Math.sin(radians);

    // Breathing opacity effect
    const baseOpacity = 0.35;
    const breathe = Math.sin(radians * 2) * 0.05; // Subtle breathing
    const redOpacity = baseOpacity + breathe;
    const blueOpacity = baseOpacity + breathe;

    keyframes += `  ${percent}% { background: radial-gradient(circle at ${redX.toFixed(1)}% ${redY.toFixed(1)}%, rgba(239, 68, 68, ${redOpacity.toFixed(2)}) 0%, transparent 40%), radial-gradient(circle at ${blueX.toFixed(1)}% ${blueY.toFixed(1)}%, rgba(59, 130, 246, ${blueOpacity.toFixed(2)}) 0%, transparent 40%); }\n`;
  }

  return keyframes;
}

function generateSecondaryKeyframes() {
  const totalFrames = 1200;
  let keyframes = '';

  for (let i = 0; i <= totalFrames; i++) {
    const percent = (i / totalFrames * 100).toFixed(1);
    const angle = (i / totalFrames) * 360; // degrees

    // Convert to radians
    const radians = angle * (Math.PI / 180);

    // Three orbs in triangular formation
    const radius1 = 20;
    const radius2 = 15;
    const radius3 = 12;

    // Green orb (larger circle)
    const greenX = 50 + radius1 * Math.cos(radians);
    const greenY = 50 + radius1 * Math.sin(radians);

    // Orange orb (medium circle, 120 degrees offset)
    const orangeX = 50 + radius2 * Math.cos(radians + (2 * Math.PI / 3));
    const orangeY = 50 + radius2 * Math.sin(radians + (2 * Math.PI / 3));

    // Purple orb (smaller circle, 240 degrees offset)
    const purpleX = 50 + radius3 * Math.cos(radians + (4 * Math.PI / 3));
    const purpleY = 50 + radius3 * Math.sin(radians + (4 * Math.PI / 3));

    // Varying opacity
    const greenOpacity = 0.28 + Math.sin(radians * 3) * 0.08;
    const orangeOpacity = 0.25 + Math.sin(radians * 2.5) * 0.06;
    const purpleOpacity = 0.22 + Math.sin(radians * 2) * 0.05;

    keyframes += `  ${percent}% { background: radial-gradient(circle at ${greenX.toFixed(1)}% ${greenY.toFixed(1)}%, rgba(16, 185, 129, ${greenOpacity.toFixed(2)}) 0%, transparent 35%), radial-gradient(circle at ${orangeX.toFixed(1)}% ${orangeY.toFixed(1)}%, rgba(245, 158, 11, ${orangeOpacity.toFixed(2)}) 0%, transparent 30%), radial-gradient(circle at ${purpleX.toFixed(1)}% ${purpleY.toFixed(1)}%, rgba(168, 85, 247, ${purpleOpacity.toFixed(2)}) 0%, transparent 25%); }\n`;
  }

  return keyframes;
}

// Generate the complete CSS
const yinYangKeyframes = generateYinYangKeyframes();
const secondaryKeyframes = generateSecondaryKeyframes();

const completeCSS = `
/* Ultra-smooth Yin-Yang circular animations with 120+ FPS (1000+ keyframes) */
@keyframes yinYangOrbs {
${yinYangKeyframes}}

@keyframes yinYangSecondary {
${secondaryKeyframes}}
`;

console.log('Generated keyframes:');
console.log(completeCSS);
