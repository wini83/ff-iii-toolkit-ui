export const ssr = false;
export const prerender = false;

 export async function load({ fetch }) {
      try {
         const res = await fetch('/config.json');

         if (!res.ok) {
             console.error("❌ config.json HTTP", res.status);
             return { API_BASE: null };
         }

         const config = await res.json();

         if (!config?.API_BASE) {
             console.error("❌ Brak API_BASE w config.json");
             return { API_BASE: null };
         }

         return { API_BASE: config.API_BASE };
     } catch (err) {
         console.error("❌ load() nie może pobrać config.json:", err);
         return { API_BASE: null };
     }
  }