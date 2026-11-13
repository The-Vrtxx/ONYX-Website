
/*
 * ONYX SHARED COSMETIC PREVIEW ENGINE
 * Used by the Owner Asset Library, Prestige Shop,
 * and Member Profile Customizer.
 *
 * This renderer is preview-only. It never purchases,
 * equips, or saves cosmetics.
 */

(function () {
  "use strict";

  const THEMES = {
    onyx: {
      start: "#0c121f",
      end: "#162737",
      accent: "#23d2c8"
    },
    frost: {
      start: "#0d192a",
      end: "#22425b",
      accent: "#87dcff"
    },
    inferno: {
      start: "#240f13",
      end: "#4c1c19",
      accent: "#ff7d41"
    },
    toxic: {
      start: "#0c1e19",
      end: "#183e2e",
      accent: "#7deb69"
    },
    eclipse: {
      start: "#141127",
      end: "#302248",
      accent: "#b587ff"
    },
    void: {
      start: "#080812",
      end: "#1b1931",
      accent: "#a091ff"
    }
  };

  const FRAMES = {
    default: "#37bebe",
    steel: "#91a5b4",
    neon: "#2debdc",
    elite: "#bea55f",
    obsidian: "#736996",
    legendary: "#ffbe5a"
  };

  const EFFECTS = {
    none: null,
    teal_glow: "#28dcd2",
    silver_shine: "#cddceb",
    electric_pulse: "#6496ff",
    cosmic_aura: "#af73ff"
  };

  const EMBLEMS = {
    veteran: {
      label: "VETERAN",
      color: "#91b9dc"
    },
    elite: {
      label: "ELITE",
      color: "#5acfff"
    },
    champion: {
      label: "CHAMPION",
      color: "#ffcd4b"
    },
    warlord: {
      label: "WARLORD",
      color: "#eb555a"
    },
    mythic: {
      label: "MYTHIC",
      color: "#cd6eff"
    }
  };

  const DEFAULT_PROFILE = {
    displayName: "ONYX Member",
    prestige: 0,
    level: 25,
    masterMode: false,
    masterLevel: 0,
    xp: 250,
    xpNeeded: 500,
    title: "",
    avatar: null
  };

  function getTheme(id) {
    return THEMES[String(id || "onyx").toLowerCase()]
      || THEMES.onyx;
  }

  function getFrame(id) {
    return FRAMES[String(id || "default").toLowerCase()]
      || FRAMES.default;
  }

  function getEffect(id) {
    return EFFECTS[String(id || "none").toLowerCase()] || null;
  }

  function roundedRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitText(ctx, value, maxWidth) {
    let text = String(value || "");

    while (text.length && ctx.measureText(text).width > maxWidth) {
      text = text.slice(0, -2) + "…";
    }

    return text;
  }

  function drawEffect(ctx, effect, width, height) {
    const color = getEffect(effect);

    if (!color) return;

    ctx.save();

    if (effect === "teal_glow") {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = color;
      ctx.lineWidth = 8;
      roundedRect(ctx, 20, 20, width - 40, height - 40, 30);
      ctx.stroke();
    }

    if (effect === "silver_shine") {
      ctx.fillStyle = "rgba(205,220,235,0.12)";
      ctx.beginPath();
      ctx.moveTo(690, 20);
      ctx.lineTo(850, 20);
      ctx.lineTo(1090, 260);
      ctx.lineTo(1090, 325);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(760, 25);
      ctx.lineTo(1080, 345);
      ctx.stroke();
    }

    if (effect === "electric_pulse") {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      roundedRect(ctx, 23, 23, width - 46, height - 46, 30);
      ctx.stroke();

      const corners = [
        [[35, 95], [65, 70], [54, 112], [86, 91]],
        [[1010, 70], [1040, 48], [1028, 91], [1065, 72]],
        [[35, 270], [66, 245], [54, 288], [88, 267]],
        [[1010, 290], [1040, 265], [1028, 308], [1065, 285]]
      ];

      ctx.lineWidth = 6;

      corners.forEach(points => {
        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point[0], point[1]);
          } else {
            ctx.lineTo(point[0], point[1]);
          }
        });
        ctx.stroke();
      });
    }

    if (effect === "cosmic_aura") {
      [
        [8, 18, 0.18],
        [18, 8, 0.4],
        [27, 3, 0.86]
      ].forEach(([inset, lineWidth, alpha]) => {
        ctx.strokeStyle = `rgba(175,115,255,${alpha})`;
        ctx.lineWidth = lineWidth;
        roundedRect(
          ctx,
          inset,
          inset,
          width - inset * 2,
          height - inset * 2,
          34
        );
        ctx.stroke();
      });

      ctx.strokeStyle = "#ebdcff";
      ctx.lineWidth = 3;

      [
        [80, 42],
        [1015, 55],
        [1040, 300],
        [75, 315],
        [550, 28]
      ].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.moveTo(x - 9, y);
        ctx.lineTo(x + 9, y);
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x, y + 9);
        ctx.stroke();
      });
    }

    ctx.restore();
  }

  function drawFrame(ctx, frame, width, height) {
    const color = getFrame(frame);

    ctx.save();

    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    roundedRect(ctx, 18, 18, width - 36, height - 36, 28);
    ctx.stroke();

    ctx.strokeStyle = "rgba(220,240,245,0.45)";
    ctx.lineWidth = 1;
    roundedRect(ctx, 31, 31, width - 62, height - 62, 22);
    ctx.stroke();

    if (frame === "neon" || frame === "legendary") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundedRect(ctx, 24, 24, width - 48, height - 48, 30);
      ctx.stroke();
    }

    if (frame === "steel") {
      ctx.strokeStyle = "#dce6f0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(55, 23);
      ctx.lineTo(width - 55, 23);
      ctx.stroke();
    }

    if (frame === "obsidian") {
      ctx.strokeStyle = "#4b4169";
      ctx.lineWidth = 2;
      roundedRect(ctx, 26, 26, width - 52, height - 52, 26);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawEmblem(ctx, emblem, prestige) {
    const custom = EMBLEMS[String(emblem || "").toLowerCase()];

    if (custom) {
      ctx.save();

      ctx.translate(890, 185);

      ctx.fillStyle = "#080c17";
      ctx.strokeStyle = custom.color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, 77, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(235,242,250,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 66, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = custom.color;
      ctx.beginPath();
      ctx.moveTo(0, -53);
      ctx.lineTo(42, -18);
      ctx.lineTo(30, 36);
      ctx.lineTo(0, 54);
      ctx.lineTo(-30, 36);
      ctx.lineTo(-42, -18);
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "bold 20px Arial";
      ctx.fillText("ONYX", 0, 3);
      ctx.font = "bold 10px Arial";
      ctx.fillText(custom.label, 0, 27);

      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(890, 185);

    const color = prestige >= 10
      ? "#cdaeff"
      : prestige >= 5
        ? "#ffcd70"
        : "#8dd9e0";

    ctx.fillStyle = "#0a111c";
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "bold 32px Arial";
    ctx.fillText(
      prestige >= 10 ? "M" : String(prestige || 0),
      0,
      12
    );

    ctx.restore();
  }

  function renderCard(canvas, profile = {}, cosmetics = {}) {
    if (!canvas || !canvas.getContext) {
      throw new Error("A valid canvas element is required.");
    }

    const ctx = canvas.getContext("2d");
    const width = 1100;
    const height = 360;

    canvas.width = width;
    canvas.height = height;

    const data = Object.assign({}, DEFAULT_PROFILE, profile);

    const theme = getTheme(cosmetics.theme_id);
    const frame = String(cosmetics.frame_id || "default").toLowerCase();
    const effect = String(cosmetics.effect_id || "none").toLowerCase();
    const emblem = String(cosmetics.emblem_id || "default").toLowerCase();

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, theme.start);
    gradient.addColorStop(1, theme.end);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.end;
    ctx.beginPath();
    ctx.ellipse(1015, 15, 225, 225, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(1060, 350, 160, 160, 0, 0, Math.PI * 2);
    ctx.fill();

    drawEffect(ctx, effect, width, height);
    drawFrame(ctx, frame, width, height);

    ctx.fillStyle = theme.accent;
    ctx.font = "bold 25px Arial";
    ctx.textAlign = "left";
    ctx.fillText("ONYX", 58, 72);

    ctx.fillStyle = "#a5b9ca";
    ctx.font = "bold 16px Arial";
    ctx.fillText("GLOBAL PROFILE", 155, 72);

    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(58, 98);
    ctx.lineTo(width - 58, 98);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#f5f9fc";
    ctx.font = "bold 43px Arial";
    ctx.fillText(
      fitText(ctx, data.displayName, 650),
      58,
      168
    );

    const stage = data.masterMode
      ? `PRESTIGE MASTER  •  LEVEL ${Number(data.masterLevel).toLocaleString()} / 1,000`
      : `${Number(data.prestige) > 0 ? `PRESTIGE ${data.prestige}  •  ` : ""}LEVEL ${Number(data.level).toLocaleString()} / 60`;

    ctx.fillStyle = theme.accent;
    ctx.font = "bold 25px Arial";
    ctx.fillText(stage, 60, 215);

    if (data.title) {
      ctx.fillStyle = "#d5e5ec";
      ctx.font = "bold 17px Arial";
      ctx.fillText(String(data.title), 60, 245);
    }

    drawEmblem(ctx, emblem, Number(data.prestige) || 0);

    const xp = Math.max(0, Number(data.xp) || 0);
    const needed = Math.max(1, Number(data.xpNeeded) || 1);
    const ratio = Math.min(1, xp / needed);

    ctx.fillStyle = "#cddce6";
    ctx.font = "bold 16px Arial";
    ctx.fillText(
      `XP  ${xp.toLocaleString()} / ${needed.toLocaleString()}`,
      60,
      300
    );

    ctx.fillStyle = "#050a12";
    roundedRect(ctx, 260, 278, 640, 20, 10);
    ctx.fill();

    if (ratio > 0) {
      ctx.fillStyle = theme.accent;
      roundedRect(ctx, 260, 278, 640 * ratio, 20, 10);
      ctx.fill();
    }

    ctx.fillStyle = "#ebf2f8";
    ctx.textAlign = "left";
    ctx.fillText(`${(ratio * 100).toFixed(1)}%`, 920, 300);

    return canvas;
  }

  function renderAsset(canvas, asset = {}) {
    if (!canvas || !canvas.getContext) {
      throw new Error("A valid canvas element is required.");
    }

    const ctx = canvas.getContext("2d");
    const width = 420;
    const height = 300;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const category = String(asset.category || "cosmetic").toLowerCase();
    const itemId = String(asset.item_id || "").toLowerCase();
    const name = String(asset.display_name || "ONYX Asset");
    const imageUrl = asset.image_url || asset.metadata?.image_url || null;

    ctx.fillStyle = "#091316";
    roundedRect(ctx, 8, 8, width - 16, height - 16, 12);
    ctx.fill();

    const theme = getTheme(itemId);
    const frame = getFrame(itemId);
    const effect = getEffect(itemId);

    if (category === "theme") {
      const gradient = ctx.createLinearGradient(35, 30, 385, 230);
      gradient.addColorStop(0, theme.start);
      gradient.addColorStop(1, theme.end);

      ctx.fillStyle = gradient;
      roundedRect(ctx, 35, 35, 350, 205, 14);
      ctx.fill();

      ctx.fillStyle = theme.accent;
      ctx.fillRect(55, 205, 310, 7);
    } else if (category === "frame" || category === "border") {
      ctx.fillStyle = "#101c23";
      roundedRect(ctx, 75, 45, 270, 170, 15);
      ctx.fill();

      ctx.strokeStyle = frame;
      ctx.lineWidth = 10;
      roundedRect(ctx, 75, 45, 270, 170, 15);
      ctx.stroke();
    } else if (category === "effect") {
      const color = effect || "#28dcd2";

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 12;
      roundedRect(ctx, 85, 55, 250, 145, 20);
      ctx.stroke();
      ctx.restore();
    } else if (category === "emblem" || category === "badge") {
      const badge = EMBLEMS[itemId] || {
        label: name.toUpperCase().slice(0, 12),
        color: "#28dcd2"
      };

      ctx.fillStyle = "#111c27";
      ctx.strokeStyle = badge.color;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(210, 135, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badge.color;
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText(badge.label, 210, 142);
    } else {
      ctx.fillStyle = "#13252b";
      roundedRect(ctx, 95, 55, 230, 145, 16);
      ctx.fill();

      ctx.strokeStyle = "#28dcd2";
      ctx.lineWidth = 3;
      roundedRect(ctx, 95, 55, 230, 145, 16);
      ctx.stroke();

      ctx.fillStyle = "#28dcd2";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText("ONYX", 210, 140);
    }

    ctx.fillStyle = "#e9ffff";
    ctx.font = "bold 17px Arial";
    ctx.textAlign = "center";
    ctx.fillText(fitText(ctx, name, 360), 210, 270);

    ctx.fillStyle = "#8da7ae";
    ctx.font = "11px Arial";
    ctx.fillText(category.toUpperCase(), 210, 288);

    if (imageUrl) {
      const image = new Image();
      image.crossOrigin = "anonymous";

      image.onload = () => {
        ctx.clearRect(20, 20, width - 40, 220);

        const maxWidth = 220;
        const maxHeight = 180;
        const scale = Math.min(
          maxWidth / image.width,
          maxHeight / image.height,
          1
        );

        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;

        ctx.drawImage(
          image,
          (width - drawWidth) / 2,
          35 + (180 - drawHeight) / 2,
          drawWidth,
          drawHeight
        );

        ctx.fillStyle = "#e9ffff";
        ctx.font = "bold 17px Arial";
        ctx.textAlign = "center";
        ctx.fillText(fitText(ctx, name, 360), 210, 270);

        ctx.fillStyle = "#8da7ae";
        ctx.font = "11px Arial";
        ctx.fillText(category.toUpperCase(), 210, 288);
      };

      image.onerror = () => {
        console.warn("ONYX preview image could not be loaded:", imageUrl);
      };

      image.src = imageUrl;
    }

    return canvas;
  }

  window.ONYXPreview = {
    renderCard,
    renderAsset,
    themes: THEMES,
    frames: FRAMES,
    effects: EFFECTS,
    emblems: EMBLEMS
  };

})();
