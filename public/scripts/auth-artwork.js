(() => {
  const artwork = [
    "/images/auth/hallstatt.webp",
    "/images/auth/positano.webp",
    "/images/auth/lauterbrunnen.webp",
    "/images/auth/pahalgam.webp",
    "/images/auth/munnar.webp",
    "/images/auth/udaipur.webp",
  ];
  const storageKey = "citius-auth-artwork";
  let previousIndex;
  try {
    const storedValue = sessionStorage.getItem(storageKey);
    const storedIndex = Number(storedValue);
    if (
      storedValue !== null &&
      Number.isInteger(storedIndex) &&
      storedIndex >= 0 &&
      storedIndex < artwork.length
    ) {
      previousIndex = storedIndex;
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }

  let index = Math.floor(Math.random() * artwork.length);
  if (index === previousIndex) {
    index = (index + 1 + Math.floor(Math.random() * (artwork.length - 1))) % artwork.length;
  }
  try {
    sessionStorage.setItem(storageKey, String(index));
  } catch {
    // The selected image still works without persisting the previous index.
  }
  const url = artwork[index];
  document.documentElement.style.setProperty("--auth-artwork-image", `url("${url}")`);
  document.documentElement.dataset.authArtwork = url.split("/").pop().split(".")[0];
  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = url;
  document.head.append(preload);
})();
