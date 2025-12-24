const STORAGE_KEY = "TRAVEL_SITE_DATA";

const defaultData = {
  settings: {
    siteName: "Trawellign",
    logo: "",
    themeColor: "#0a7cff",
    fontFamily: "Inter",
    fontColor: "#0f172a",
    heroTitle: "Explore curated travel packages",
    heroSubtitle: "Discover memorable journeys and experiences",
  },
  auth: { username: "kandarp@gmail.com", password: "Mohit@2026-26" },
  packages: [],
  testimonials: []
};

function getData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}