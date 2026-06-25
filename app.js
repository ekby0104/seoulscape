// TODO: Add a "favorites" feature so users can bookmark neighborhoods
// TODO: Add a detail modal/page that shows a full neighborhood guide with map embed

// --- Search & filter implementation ---

const searchInput = document.getElementById("search-input");
const filterContainer = document.getElementById("filter-buttons");
const grid = document.getElementById("neighborhood-grid");
const emptyState = document.getElementById("empty-state");
const resultCount = document.getElementById("result-count");

let activeFilter = "all";

// --- URL hash persistence (shareable links) ---
// Hash format: #filter=<tag>&q=<query>

function readHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    filter: params.get("filter") || "all",
    query: params.get("q") || "",
  };
}

function writeHash(filter, query) {
  const params = new URLSearchParams();
  if (filter && filter !== "all") params.set("filter", filter);
  if (query) params.set("q", query);
  const hash = params.toString();
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
}

function applyHash() {
  const { filter, query } = readHash();

  activeFilter = filter;
  searchInput.value = query;

  filterContainer.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === activeFilter);
  });

  render();
}

window.addEventListener("hashchange", applyHash);

function getAllTags() {
  const tagSet = new Set();
  neighborhoods.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

function buildFilterButtons() {
  getAllTags().forEach((tag) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn";
    btn.dataset.filter = tag;
    btn.textContent = tag;
    filterContainer.appendChild(btn);
  });

  filterContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    filterContainer.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    writeHash(activeFilter, searchInput.value);
    render();
  });
}

function normalise(str) {
  return str.toLowerCase().trim();
}

function matchesSearch(neighborhood, query) {
  if (!query) return true;
  const q = normalise(query);
  return (
    normalise(neighborhood.name).includes(q) ||
    normalise(neighborhood.district).includes(q) ||
    normalise(neighborhood.description).includes(q) ||
    neighborhood.tags.some((t) => normalise(t).includes(q))
  );
}

function matchesFilter(neighborhood) {
  if (activeFilter === "all") return true;
  return neighborhood.tags.includes(activeFilter);
}

function createCard(neighborhood) {
  const article = document.createElement("article");
  article.className = "card";

  const img = document.createElement("img");
  img.src = neighborhood.image;
  img.alt = neighborhood.name;
  img.loading = "lazy";

  const body = document.createElement("div");
  body.className = "card-body";

  const heading = document.createElement("h2");
  heading.textContent = neighborhood.name;

  const district = document.createElement("p");
  district.className = "district";
  district.textContent = neighborhood.district;

  const desc = document.createElement("p");
  desc.className = "description";
  desc.textContent = neighborhood.description;

  const highlight = document.createElement("p");
  highlight.className = "highlight";
  highlight.textContent = `✦ ${neighborhood.highlight}`;

  const tagList = document.createElement("ul");
  tagList.className = "tags";
  neighborhood.tags.forEach((tag) => {
    const li = document.createElement("li");
    li.textContent = tag;
    tagList.appendChild(li);
  });

  body.append(heading, district, desc, highlight, tagList);
  article.append(img, body);
  return article;
}

function render() {
  const query = searchInput.value;
  const filtered = neighborhoods.filter(
    (n) => matchesSearch(n, query) && matchesFilter(n)
  );

  grid.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    resultCount.textContent = "";
  } else {
    emptyState.classList.add("hidden");
    filtered.forEach((n) => grid.appendChild(createCard(n)));
    resultCount.textContent = `Showing ${filtered.length} of ${neighborhoods.length} neighborhoods`;
  }
}

searchInput.addEventListener("input", () => {
  writeHash(activeFilter, searchInput.value);
  render();
});

buildFilterButtons();
applyHash();
