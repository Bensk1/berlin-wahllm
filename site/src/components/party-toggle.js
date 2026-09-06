function observeStickyState(input) {
  const attach = () => {
    const wrapper = input.parentElement;
    if (!wrapper) return;

    const sentinel = document.createElement("span");
    sentinel.className = "party-toggle-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    wrapper.before(sentinel);

    const observer = new IntersectionObserver(([entry]) => {
      const aboveViewport = entry.rootBounds && entry.boundingClientRect.top < entry.rootBounds.top;
      wrapper.classList.toggle("party-toggle-stuck", !entry.isIntersecting && aboveViewport);
    }, {rootMargin: "-6px 0px 100000px 0px"});
    observer.observe(sentinel);
  };

  if (input.isConnected) {
    attach();
    return;
  }

  const connectionObserver = new MutationObserver(() => {
    if (!input.isConnected) return;
    connectionObserver.disconnect();
    attach();
  });
  connectionObserver.observe(document.documentElement, {childList: true, subtree: true});
}

export function compactStickyPartyToggle(input, labels) {
  const optionLabels = [...input.querySelectorAll("div > label")];
  if (optionLabels.length !== labels.length) {
    throw new Error("Die Parteienauswahl enthält nicht die erwarteten Optionen.");
  }

  optionLabels.forEach((label, index) => {
    const radio = label.querySelector('input[type="radio"]');
    const textNode = [...label.childNodes].find((node) => node.nodeType === 3);
    if (!radio || !textNode) {
      throw new Error("Die Parteienauswahl hat eine unerwartete Struktur.");
    }

    radio.setAttribute("aria-label", labels[index].long);
    const longLabel = document.createElement("span");
    longLabel.className = "party-option-long";
    longLabel.textContent = labels[index].long;
    const compactLabel = document.createElement("span");
    compactLabel.className = "party-option-compact";
    compactLabel.textContent = labels[index].compact;
    textNode.replaceWith(longLabel, compactLabel);
  });

  observeStickyState(input);
  return input;
}
