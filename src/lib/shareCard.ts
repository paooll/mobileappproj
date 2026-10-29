/**
 * Canvas renderer for 9:16 high-res (1080x1920) workout summary cards.
 * Zero external libraries: pure native HTML5 Canvas API.
 */

export interface ShareCardData {
  workoutName: string;
  date: string;
  setsCount: number;
  volumeText: string;
  topExercises: string[];
}

export async function generateShareCardBlob(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  // Dark minimalist background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
  bgGrad.addColorStop(0, "#0c0c0e");
  bgGrad.addColorStop(0.5, "#141417");
  bgGrad.addColorStop(1, "#0a0a0c");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1920);

  // Subtle accent ambient glow at top
  const glow = ctx.createRadialGradient(540, 200, 50, 540, 200, 600);
  glow.addColorStop(0, "rgba(249, 115, 22, 0.15)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 800);

  // Border card container
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 4;
  ctx.roundRect(80, 80, 920, 1760, 48);
  ctx.stroke();

  // Header Brand
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("REPRANGE", 140, 180);

  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "500 32px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(data.date, 940, 180);

  // Divider
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 230);
  ctx.lineTo(940, 230);
  ctx.stroke();

  // Workout Title
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 80px sans-serif";
  const name = data.workoutName.length > 20 ? data.workoutName.slice(0, 20) + "…" : data.workoutName;
  ctx.fillText(name, 140, 360);

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = "500 36px sans-serif";
  ctx.fillText("WORKOUT SUMMARY", 140, 420);

  // Stat Card 1: Sets
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.roundRect(140, 500, 380, 280, 32);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "600 30px sans-serif";
  ctx.fillText("TOTAL SETS", 180, 570);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 96px sans-serif";
  ctx.fillText(`${data.setsCount}`, 180, 690);

  // Stat Card 2: Volume
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.roundRect(560, 500, 380, 280, 32);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "600 30px sans-serif";
  ctx.fillText("TOTAL VOLUME", 600, 570);

  ctx.fillStyle = "#f97316";
  ctx.font = "bold 76px sans-serif";
  ctx.fillText(data.volumeText, 600, 680);

  // Exercises Section
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText("EXERCISES LOGGED", 140, 880);

  let curY = 960;
  const exercises = data.topExercises.length > 0 ? data.topExercises.slice(0, 6) : ["Full Workout Session"];
  for (const ex of exercises) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.roundRect(140, curY, 800, 100, 24);
    ctx.fill();

    // Small dot
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.arc(190, curY + 50, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 36px sans-serif";
    const displayName = ex.length > 28 ? ex.slice(0, 28) + "…" : ex;
    ctx.fillText(displayName, 230, curY + 62);

    curY += 120;
  }

  // Footer Tagline
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "500 32px sans-serif";
  ctx.fillText("Tracked with Reprange · The minimalist workout tracker", 540, 1720);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}
