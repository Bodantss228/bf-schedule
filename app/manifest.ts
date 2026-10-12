import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Расписание БФ ПНИПУ",
    short_name: "Расписание",
    description: "Пары групп и преподавателей",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafb",
    theme_color: "#047857",
    lang: "ru",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
