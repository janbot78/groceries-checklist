const STORAGE_KEY = "janna-groceries-v1";

const SEED = [
  { name: "shampoo", category: "Personal care / bath" },
  { name: "conditioner", category: "Personal care / bath" },
  { name: "body wash", category: "Personal care / bath" },
  { name: "loofah", category: "Personal care / bath" },
  { name: "dog food", category: "Pet" },
  { name: "white vinegar", category: "Household" },
  { name: "Halloween tights", category: "Seasonal / holiday" },
];

const summaryEl = document.querySelector("#summary");
const saveNoteEl = document.querySelector("#save-note");
const listEl = document.querySelector("#list");
const formEl = document.querySelector("#add-form");
const nameInput = document.querySelector("#item-name");
const categoryInput = document.querySelector("#item-category");
const categoriesEl = document.querySelector("#categories");
const formMessageEl = document.querySelector("#form-message");
const uncheckAllBtn = document.querySelector("#uncheck-all");
const removeCheckedBtn = document.querySelector("#remove-checked");
const confirmDialog = document.querySelector("#confirm-dialog");
const confirmText = document.querySelector("#confirm-text");

let items = loadItems();
let saveError = "";
saveItems(); // persist any newly merged seed items

function uid() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function seedItems() {
  return SEED.map((item) => ({
    id: uid(),
    name: item.name,
    category: item.category,
    checked: false,
  }));
}

function isItem(value) {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      value.name.trim() &&
      typeof value.category === "string" &&
      value.category.trim() &&
      typeof value.checked === "boolean"
  );
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return seedItems();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isItem)) return seedItems();
    return mergeSeed(parsed);
  } catch {
    return seedItems();
  }
}

function mergeSeed(existing) {
  const have = new Set(existing.map((item) => item.name.toLowerCase()));
  const additions = SEED.filter((item) => !have.has(item.name.toLowerCase())).map((item) => ({
    id: uid(),
    name: item.name,
    category: item.category,
    checked: false,
  }));
  if (!additions.length) return existing;
  return existing.concat(additions);
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    saveError = "";
  } catch {
    saveError = "This browser blocked saving, so checks may reset when you leave the page.";
  }
}

function cleanText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function canonicalCategory(name) {
  const match = items.find(
    (item) => item.category.toLowerCase() === name.toLowerCase()
  );
  return match ? match.category : name;
}

function groups() {
  const order = [];
  const byName = new Map();
  for (const item of items) {
    if (!byName.has(item.category)) {
      byName.set(item.category, []);
      order.push(item.category);
    }
    byName.get(item.category).push(item);
  }
  return order.map((category) => ({
    category,
    items: byName.get(category),
  }));
}

function updateChrome() {
  const checked = items.filter((item) => item.checked).length;
  const remaining = items.length - checked;

  if (items.length === 0) {
    summaryEl.textContent = "Nothing on the list.";
  } else if (remaining === 0) {
    summaryEl.textContent = "All set. Everything is checked off.";
  } else if (checked === 0) {
    summaryEl.textContent = `${remaining} to get`;
  } else {
    summaryEl.textContent = `${remaining} to get, ${checked} checked`;
  }

  saveNoteEl.hidden = !saveError;
  saveNoteEl.textContent = saveError;
  uncheckAllBtn.disabled = checked === 0;
  removeCheckedBtn.disabled = checked === 0;

  categoriesEl.replaceChildren();
  const seen = new Set();
  for (const item of items) {
    const key = item.category.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const option = document.createElement("option");
    option.value = item.category;
    categoriesEl.append(option);
  }
}

function renderItem(item) {
  const li = document.createElement("li");
  const label = document.createElement("label");
  label.className = item.checked ? "item is-checked" : "item";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = item.checked;
  input.dataset.id = item.id;

  const name = document.createElement("span");
  name.className = "item-name";
  name.textContent = item.name;

  input.addEventListener("change", () => {
    item.checked = input.checked;
    saveItems();
    render(item.id);
  });

  label.append(input, name);
  li.append(label);
  return li;
}

function render(focusId) {
  updateChrome();
  listEl.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "The list is clear. Add something below when you think of it.";
    listEl.append(empty);
    return;
  }

  for (const group of groups()) {
    const section = document.createElement("section");
    section.className = "category";
    const heading = document.createElement("h2");
    heading.textContent = group.category;
    const ul = document.createElement("ul");
    const ordered = [
      ...group.items.filter((item) => !item.checked),
      ...group.items.filter((item) => item.checked),
    ];
    for (const item of ordered) ul.append(renderItem(item));
    section.append(heading, ul);
    listEl.append(section);
  }

  if (focusId) {
    const field = listEl.querySelector(`[data-id="${focusId}"]`);
    if (field) field.focus({ preventScroll: true });
  }
}

function setFormMessage(message, field) {
  formMessageEl.textContent = message;
  formMessageEl.classList.toggle("is-error", Boolean(field));
  nameInput.removeAttribute("aria-invalid");
  categoryInput.removeAttribute("aria-invalid");
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cleanText(nameInput.value);
  const categoryRaw = cleanText(categoryInput.value);

  if (!name) {
    setFormMessage("Enter the item you need.", nameInput);
    return;
  }
  if (!categoryRaw) {
    setFormMessage("Enter a category, such as Pantry or Pet.", categoryInput);
    return;
  }

  const category = canonicalCategory(categoryRaw);
  const duplicate = items.some(
    (item) =>
      item.name.toLowerCase() === name.toLowerCase() &&
      item.category.toLowerCase() === category.toLowerCase()
  );
  if (duplicate) {
    setFormMessage(`${name} is already under ${category}.`, nameInput);
    return;
  }

  items.push({ id: uid(), name, category, checked: false });
  saveItems();
  nameInput.value = "";
  setFormMessage(`Added ${name} under ${category}.`, null);
  render();
  nameInput.focus();
});

function clearFormMessageOnEdit(field) {
  field.addEventListener("input", () => {
    field.removeAttribute("aria-invalid");
    formMessageEl.textContent = "";
    formMessageEl.classList.remove("is-error");
  });
}

clearFormMessageOnEdit(nameInput);
clearFormMessageOnEdit(categoryInput);

uncheckAllBtn.addEventListener("click", () => {
  for (const item of items) item.checked = false;
  saveItems();
  render();
});

removeCheckedBtn.addEventListener("click", () => {
  const checked = items.filter((item) => item.checked);
  if (checked.length === 0) return;
  confirmText.textContent =
    checked.length === 1
      ? `Remove “${checked[0].name}” from the list?`
      : `Remove ${checked.length} checked items from the list?`;
  confirmDialog.showModal();
});

confirmDialog.addEventListener("close", () => {
  if (confirmDialog.returnValue !== "remove") return;
  items = items.filter((item) => !item.checked);
  saveItems();
  render();
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  items = loadItems();
  render();
});

render();
