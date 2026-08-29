/* Pixel template for the constant text "CURRENT REWARD VALUE" on the
   Trail Complete! interface. Only the near-white core pixels are opaque;
   everything else is transparent, which Alt1 treats as a wildcard, so the
   match survives whatever is behind/around the text.
   Cut from a 100% UI-scale screenshot; ANCHOR_DX/DY are the offset from the
   template's top-left corner to the character origin (left edge, baseline)
   that OCR.readLine() wants. */
window.ANCHOR_DX = 9;
window.ANCHOR_DY = 10;
window.ANCHOR_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIcAAAAMCAYAAABIkK4RAAAB0UlEQVR4nO1Y25GDMAw018CFCtJ/Lw6QAgJLAxYd7H0kZoJjg8xj7m6G/Uu0lteSkAzGnDhx4sQm3JuGAAiAPcB32zAISTK2LvyfLwAdB5HomikPu/CWdAEdgY7v/nogea69z0RSpX8Y9GfU7h3nPc8yiPDeNHE+0EUNt9vt43CpzXJ+b+WFtlCndl3KpuGv0dq17UchxgphzsdS0rdoJMmqqqgi5zjdQ+Ta4iDJtn1kBfk3iiPlJ0dLbgfP1TixAaCI+7fF4Z8kknTOqfwt2Y7SmrJrteA16o8uDmstjTHm63q9GudEo201iqIotvKe3aFlOAK/L5dxbVmWJiyQo6DRGt7bjDGmB8zj8exyvrDruhp1z42NQWTcW1NQ2riHKMtyFKtuaymeRC5ePkC6kbDM09reO8jenWOr1jmOZp2IsG1bpkbLEfHcfOeo6+ojQZp1u8/IF5xzPk5/bqx4TsgTiSfcI+wozjn6DrSnxg9bVVWq7hHjxN50UgnbwvNzUOPD+zmyONZo9UDXRTlHFGyOxtlXaGstRYQ9wBTRWktxjgB4b+pkwjTFkMPz3PA7w1xAU0kaFp7SGFZrXfnNYqI34YPkpHus1YjI3ejEiVn8ABiWFkdDrpH1AAAAAElFTkSuQmCC";
