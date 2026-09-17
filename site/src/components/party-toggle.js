export function compactPartyToggle(input, labels) {
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
  return input;
}
