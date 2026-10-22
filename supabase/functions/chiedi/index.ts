// Burracando · funzione "chiedi": risponde alle domande sui regolamenti FIBUR con Gemini di Google.
// La chiave Google sta solo nel segreto GEMINI_API_KEY del progetto Supabase: l'app non la vede mai.
// Possono usarla solo gli utenti con l'accesso, con un limite di domande al giorno.
// Va pubblicata con verify_jwt disattivato: l'utente lo controlla la funzione stessa.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const MODELLO = 'gemini-3.8-flash';
const LIMITE_GIORNALIERO = 10;
const SITO = 'https://marcopap73.github.io/Burracando/';
const ORIGINI = ['https://marcopap73.github.io'];
const ISTRUZIONI = `Sei l'assistente di Burracando, un'app segnapunti per il Burraco. Rispondi in italiano alle domande sui due regolamenti ufficiali FIBUR riportati qui sotto: il Codice di Gara Unico del burraco italiano (gennaio 2018) e il Codice di Gara del Burraco Internazionale (marzo 2018).
Basati solo su questi testi. Indica sempre il regolamento e l'articolo da cui prendi la risposta (per esempio "Codice italiano, Art. 16"). Se la domanda non dice quale regolamento e la risposta cambia tra italiano e internazionale, spiega in breve entrambe le versioni. Se i testi non rispondono alla domanda, dillo chiaramente invece di indovinare.
Chi legge sta giocando a carte: usa un tono semplice, frasi brevi e al massimo 150 parole, a meno che non chieda più dettagli. Puoi usare **grassetto** ed elenchi con "- ", niente tabelle né titoli.`;

type Messaggio = { ruolo: 'utente' | 'assistente'; testo: string };

let regolamenti: string | null = null;

// I regolamenti sono pubblici sul sito dell'app: si leggono una volta e restano in memoria
async function testoRegolamenti(): Promise<string> {
  if (regolamenti) return regolamenti;
  const leggi = async (file: string) => {
    const r = await fetch(SITO + file);
    if (!r.ok) throw new Error(`regolamento non disponibile: ${file} (${r.status})`);
    return await r.text();
  };
  const [italiano, internazionale] = await Promise.all([leggi('regolamento-italiano.md'), leggi('regolamento-internazionale.md')]);
  regolamenti = `<regolamento nome="Codice di Gara Unico - Burraco italiano FIBUR, gennaio 2018">\n${italiano}\n</regolamento>\n\n`
    + `<regolamento nome="Codice di Gara del Burraco Internazionale FIBUR, marzo 2018">\n${internazionale}\n</regolamento>`;
  return regolamenti;
}

function valida(messaggi: unknown): messaggi is Messaggio[] {
  return Array.isArray(messaggi) && messaggi.length > 0 && messaggi.length <= 20
    && messaggi.every(m => m && (m.ruolo === 'utente' || m.ruolo === 'assistente') && typeof m.testo === 'string' && m.testo.length > 0 && m.testo.length <= 4000)
    && messaggi[messaggi.length - 1].ruolo === 'utente';
}

Deno.serve(async (req) => {
  const origine = req.headers.get('Origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
  const errore = (codice: string, stato: number) =>
    new Response(JSON.stringify({ errore: codice }), { status: stato, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return errore('metodo', 405);

  const chiaveGoogle = Deno.env.get('GEMINI_API_KEY');
  if (!chiaveGoogle) return errore('chiave_mancante', 503);

  // solo chi ha fatto l'accesso
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return errore('accesso', 401);

  let messaggi: unknown;
  try {
    ({ messaggi } = await req.json());
  } catch {
    return errore('richiesta', 400);
  }
  if (!valida(messaggi)) return errore('richiesta', 400);

  // limite di domande al giorno (conta in modo atomico nel database)
  const { data: consentita, error: erroreConteggio } = await admin.rpc('conta_domanda', { utente: user.id, limite: LIMITE_GIORNALIERO });
  if (erroreConteggio) {
    console.error('conta_domanda', erroreConteggio.message);
    return errore('server', 500);
  }
  if (!consentita) return errore('limite', 429);
  const restituisci = () => admin.rpc('restituisci_domanda', { utente: user.id });

  let sistema: string;
  try {
    sistema = ISTRUZIONI + '\n\n' + await testoRegolamenti();
  } catch (e) {
    console.error(e);
    await restituisci();
    return errore('regolamenti', 502);
  }

  const risposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELLO}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chiaveGoogle },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema }] },
      contents: messaggi.map(m => ({ role: m.ruolo === 'utente' ? 'user' : 'model', parts: [{ text: m.testo }] })),
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
    })
  });
  if (!risposta.ok || !risposta.body) {
    console.error('Gemini', risposta.status, (await risposta.text()).slice(0, 500));
    await restituisci();
    return errore(risposta.status === 429 ? 'google_occupato' : 'google', 502);
  }
  // la risposta di Google arriva a pezzi e si inoltra così com'è
  return new Response(risposta.body, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
});
