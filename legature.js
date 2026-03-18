const boxes = document.querySelectorAll(".box");

boxes.forEach((box) => {
  box.addEventListener("click", () => {
    const isActive = box.classList.contains("is-active");

    boxes.forEach((item) => item.classList.remove("is-active"));

    if (!isActive) {
      const rect = box.getBoundingClientRect();
      const scaleX = (window.innerWidth * 0.9) / rect.width;
      const scaleY = (window.innerHeight * 0.9) / rect.height;

      box.style.setProperty("--scale-x", scaleX.toFixed(3));
      box.style.setProperty("--scale-y", scaleY.toFixed(3));
      box.classList.add("is-active");
    }
  });
});
