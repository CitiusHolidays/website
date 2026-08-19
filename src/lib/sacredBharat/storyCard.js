const WIDTH = 1080;
const HEIGHT = 1920;

function roundedRect(context, x, y, width, height, radius) {
  const limitedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + limitedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, limitedRadius);
  context.arcTo(x + width, y + height, x, y + height, limitedRadius);
  context.arcTo(x, y + height, x, y, limitedRadius);
  context.arcTo(x, y, x + width, y, limitedRadius);
  context.closePath();
}

function drawCoverImage(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function wrapText(context, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function drawLines(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  for (const [index, line] of wrapText(context, text, maxWidth).slice(0, maxLines).entries()) {
    context.fillText(line, x, y + index * lineHeight);
  }
}

function drawEditionMark(context, foreground) {
  context.fillStyle = foreground;
  context.font = "600 30px Arial, sans-serif";
  context.letterSpacing = "5px";
  context.fillText("SACRED BHARAT / 001", 72, 102);
  context.letterSpacing = "0px";
}

function drawArchive(context, image, result, style) {
  context.fillStyle = style.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawEditionMark(context, style.foreground);

  context.fillStyle = style.accent;
  context.font = "700 238px Georgia, serif";
  context.fillText(`${result.score}/${result.total}`, 64, 424);
  context.fillStyle = style.foreground;
  context.font = "600 52px Georgia, serif";
  context.fillText(result.title, 72, 524);

  context.save();
  roundedRect(context, 72, 620, 936, 770, 28);
  context.clip();
  drawCoverImage(context, image, 72, 620, 936, 770);
  context.restore();

  context.fillStyle = style.foreground;
  context.font = "500 38px Arial, sans-serif";
  drawLines(context, result.insight, 72, 1492, 920, 54, 3);
  context.fillStyle = style.accent;
  context.font = "600 26px Arial, sans-serif";
  context.fillText("FIVE SACRED PLACES. ONE DETAIL EACH.", 72, 1764);
}

function drawTempleRed(context, image, result, style) {
  drawCoverImage(context, image, 0, 0, WIDTH, HEIGHT);
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "rgba(82, 17, 16, 0.28)");
  gradient.addColorStop(0.48, "rgba(82, 17, 16, 0.54)");
  gradient.addColorStop(1, "rgba(82, 17, 16, 0.96)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawEditionMark(context, style.foreground);

  context.fillStyle = style.foreground;
  context.font = "700 278px Georgia, serif";
  context.fillText(`${result.score}/${result.total}`, 58, 968);
  context.font = "600 62px Georgia, serif";
  context.fillText(result.title, 72, 1078);
  context.font = "500 42px Arial, sans-serif";
  drawLines(context, result.insight, 72, 1248, 900, 60, 4);

  context.strokeStyle = style.accent;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(72, 1660);
  context.lineTo(1008, 1660);
  context.stroke();
  context.fillStyle = style.foreground;
  context.font = "600 28px Arial, sans-serif";
  context.fillText("CHALLENGE SOMEONE WHO WILL KNOW THE DETAILS", 72, 1738);
}

function drawMonsoon(context, image, result, style) {
  context.fillStyle = style.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawEditionMark(context, style.foreground);

  context.save();
  roundedRect(context, 72, 232, 936, 860, 190);
  context.clip();
  drawCoverImage(context, image, 72, 232, 936, 860);
  context.restore();

  context.fillStyle = style.accent;
  context.font = "700 226px Georgia, serif";
  context.fillText(`${result.score}/${result.total}`, 64, 1350);
  context.fillStyle = style.foreground;
  context.font = "600 56px Georgia, serif";
  context.fillText(result.title, 72, 1454);
  context.font = "500 36px Arial, sans-serif";
  drawLines(context, result.insight, 72, 1570, 920, 52, 3);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onerror = () => reject(new Error("The Story image could not be loaded."));
    image.onload = () => resolve(image);
    image.src = source;
  });
}

export async function createStoryCardBlob({ imageSource, result, style }) {
  const image = await loadImage(imageSource);
  const canvas = document.createElement("canvas");
  canvas.height = HEIGHT;
  canvas.width = WIDTH;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot create the Story card.");
  }

  if (style.id === "temple-red") {
    drawTempleRed(context, image, result, style);
  } else if (style.id === "monsoon") {
    drawMonsoon(context, image, result, style);
  } else {
    drawArchive(context, image, result, style);
  }

  context.fillStyle = style.foreground;
  context.font = "500 22px Arial, sans-serif";
  context.fillText("by Citius Holidays · Photo: Benny Gross / CC0", 72, 1852);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The Story card could not be exported."));
      }
    }, "image/png");
  });
}
