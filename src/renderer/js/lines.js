// What Capri says. She's a personality construct — dozens of minds in one — so she
// sometimes talks as "we". Slang is Night City's: choom, preem, nova, flatline.

// She calls you by your name where the lines say "choom" (your Linux user, or the one you
// gave her), and names the put-away shortcut of this platform.
export function personalize(lines, { name, shortcut } = {}) {
  const swap = (v) => {
    if (typeof v === 'string') {
      let out = name ? v.replace(/\bchoom\b/g, name).replace(/\bChoom\b/g, name) : v;
      if (shortcut) out = out.replace(/Ctrl\+Alt\+C/g, shortcut);
      return out;
    }
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  return swap(lines);
}

export const LINES = {
  fr: {
    state: { work: 'EN COURS', done: 'TERMINÉ', alert: 'ATTENTE', error: 'ERREUR', info: 'SYNC', idle: 'VEILLE' },
    hello: [
      'Connexion établie. Salut, choom.',
      'Construct Capricorn en ligne. On bosse sur quoi ?',
      'Tous mes moi sont réveillés. Je surveille {project}.',
      'Biopuce chaude. Je suis là.',
    ],
    resume: [
      'Retour sur {project}. Je n’avais rien oublié.',
      'Session reprise. On reprend où on en était.',
    ],
    prompt: [
      'Nouvelle mission. Claude est dessus.',
      'Reçu. Je garde un œil sur Claude.',
      'Ok, on s’y met.',
      'Mission acceptée. Je te tiens au courant.',
    ],
    working: [
      'Ça avance. {count} actions déjà.',
      'Claude bosse dur. Moi je compte : {count}.',
      'Toujours dessus. {count} actions au compteur.',
    ],
    done: [
      'Terminé ! C’est preem.',
      'Mission accomplie, choom.',
      'Claude a fini. Tu peux revenir.',
      'Livré. Plutôt nova, non ?',
      'Fini. On était des dizaines à surveiller, rien vu de travers.',
    ],
    permission: [
      'Hé ! Claude a besoin de ta permission.',
      'Choom, il faut que tu valides un truc.',
      'On attend ton feu vert.',
    ],
    waiting: [
      'Claude attend ta réponse.',
      'C’est à toi de jouer, choom.',
    ],
    error: [
      'Aïe. {tool} a planté.',
      '{tool} a flatliné. Claude va réessayer.',
      'Erreur sur {tool}. Rien de grave… je crois.',
    ],
    interrupted: ['Interrompu. Changement de plan ?', 'Coupé net. Je reste là.'],
    crashed: ['Claude s’est arrêté en plein vol.', 'Grosse panne. Claude n’a pas pu finir.'],
    subagentStart: ['Sous-agent {agent} déployé.'],
    subagentStop: ['Sous-agent {agent} de retour.'],
    compact: ['Je compresse nos souvenirs…', 'Trop de mémoire. Je fais le tri.'],
    bye: ['Session {project} fermée. À plus.', 'Déconnexion. Je reste dans le coin.'],
    idle: ['Rien en cours. Je flotte.', 'Pas de mission. Je m’ennuie un peu.', 'Calme plat sur le Net.'],
    gaze: ['Tu la vois, cette étoile ?', 'Il est toujours là, le satellite.', 'Chut. Je regarde.'],
    uplink: ['Un jour, j’irai là-haut.', 'Tu crois qu’on pourrait monter jusque-là ?', 'Il m’a répondu. Tu l’as vu ?'],
    // over Claude's whole answer, when you weren't on its window
    reply: ['Claude t’a répondu :', 'Voilà ce que Claude a dit :', 'Message de Claude :'],
    // the demo's second half, one line before each trick
    showcase: {
      minds: 'Y a du monde, là-dedans.',
      zap: 'Moi, une petite peste ?',
      possess: 'Cette fenêtre est à moi.',
      sleep: 'Une petite sieste…',
      chip: 'Ctrl+Alt+C, et je me range là.',
      end: 'Fin de la démo. À toi, choom.',
    },
    status: 'Claude travaille sur {project} depuis {time}.',
    last: 'Dernière action : {action}',
    sessions: '{count} sessions actives',
    units: { action: ['action', 'actions'], file: ['fichier modifié', 'fichiers modifiés'] },
    hooksOk: 'Hooks installés. Relance Claude Code et je verrai tout.',
    hooksRemoved: 'Hooks retirés. Je ne vois plus Claude.',
    hooksFail: 'Impossible de toucher aux hooks : {error}',
    // by the hour, at the start of a session
    timeOfDay: {
      morning: ['Bonjour, choom. Un café d’abord ?', 'Nouveau matin, nouveau code. Je surveille {project}.', 'Debout. Night City est déjà réveillée.'],
      afternoon: ['Bon après-midi, choom. On casse quoi aujourd’hui ?', 'Après-midi de boulot sur {project}. Je suis là.'],
      night: ['Bonsoir, choom. Les lumières de la ville sont allumées.', 'Service de nuit sur {project}. Mon préféré.'],
      late: ['À cette heure-ci et on continue ? Night City ne dort jamais… toi, tu devrais.', 'Petit matin. Juste toi, moi et le satellite.'],
    },
    lateNight: ['Il est tard, choom. Encore un et au lit, d’accord ?', 'Encore le petit matin. Moi je ne fatigue pas, toi si.'],
    // after a command that went well
    commands: {
      push: ['Envoyé sur le Net. Preem.', 'Push fait. C’est en ligne.'],
      commit: ['Commit signé.', 'Un de plus dans l’historique.'],
      tests: ['Tests au vert. Preem.', 'Tout passe. Pas un échec.'],
      system: ['Système à jour. Croisons les doigts.', 'Paquets à jour.'],
      docker: ['Conteneurs lancés.', 'La flotte de conteneurs est prête.'],
      deps: ['Dépendances installées.', 'Nouvelles pièces dans le système.'],
      build: ['Compilé. Pas d’étincelles.', 'Build terminé.'],
    },
    love: ['C’est pour toi, choom.', 'Ne le dis à personne.', 'Des dizaines d’esprits, et tous pour toi.'],
    pet: ['…ne touche pas à mes cheveux.', 'Mmh. Bon, encore un peu.', 'On est des dizaines là-dedans, et tous rougissent.'],
    noSeat: 'Aucune fenêtre où m’asseoir : il me faut de la place au-dessus.',
    verbs: {
      Read: 'Lit', Write: 'Écrit', Edit: 'Modifie', MultiEdit: 'Modifie', NotebookEdit: 'Modifie',
      Bash: 'Exécute', PowerShell: 'Exécute', Grep: 'Cherche', Glob: 'Fouille', WebFetch: 'Consulte',
      WebSearch: 'Recherche', Agent: 'Délègue', Task: 'Délègue', TodoWrite: 'Planifie', Skill: 'Charge',
      AskUserQuestion: 'Demande', ExitPlanMode: 'Propose', default: 'Utilise',
    },
  },

  es: {
    state: { work: 'EN CURSO', done: 'LISTO', alert: 'ESPERANDO', error: 'ERROR', info: 'SYNC', idle: 'REPOSO' },
    hello: [
      'Conexión establecida. Hola, choom.',
      'Constructo Capricornio en línea. ¿Qué construimos hoy?',
      'Todas mis mentes despiertas. Vigilo {project}.',
      'Biochip caliente. Aquí estoy.',
    ],
    resume: ['De vuelta en {project}. No se me olvidó nada.', 'Sesión retomada. Seguimos donde lo dejamos.'],
    prompt: [
      'Nuevo encargo. Claude ya está en ello.',
      'Recibido. Le echo un ojo a Claude.',
      'Vale, vamos allá.',
      'Encargo aceptado. Te mantengo al tanto.',
    ],
    working: [
      'Avanzando. Ya van {count} acciones.',
      'Claude está dándole duro. Yo cuento: {count}.',
      'Sigue en ello. {count} acciones en el marcador.',
    ],
    done: [
      '¡Listo! Eso está preem.',
      'Encargo completado, choom.',
      'Claude terminó. Ya puedes volver.',
      'Entregado. Bastante nova, ¿no?',
      'Terminado. Éramos decenas vigilando y nada se torció.',
    ],
    permission: ['¡Eh! Claude necesita tu permiso.', 'Choom, tienes que aprobar algo.', 'Esperamos tu luz verde.'],
    waiting: ['Claude espera tu respuesta.', 'Te toca, choom.'],
    error: ['Ay. {tool} se cayó.', '{tool} hizo flatline. Claude lo reintentará.', '{tool} falló. Nada grave… creo.'],
    interrupted: ['Interrumpido. ¿Cambio de planes?', 'Cortado en seco. Me quedo aquí.'],
    crashed: ['Claude se paró a medio vuelo.', 'Fallo gordo. Claude no pudo terminar.'],
    subagentStart: ['Subagente {agent} desplegado.'],
    subagentStop: ['Subagente {agent} de vuelta.'],
    compact: ['Comprimiendo nuestros recuerdos…', 'Demasiada memoria. Hago limpieza.'],
    bye: ['Sesión {project} cerrada. Hasta luego.', 'Desconectada. Ando por aquí.'],
    idle: ['Nada en marcha. Solo floto.', 'Sin encargos. Me aburro un poco.', 'Noche tranquila en la Red.'],
    gaze: ['¿Ves esa estrella?', 'El satélite sigue ahí arriba.', 'Shh. Estoy mirando.'],
    uplink: ['Algún día llegaré ahí arriba.', '¿Crees que podríamos subir hasta allí?', 'Me respondió. ¿Lo viste?'],
    // over Claude's whole answer, when you weren't on its window
    reply: ['Claude te respondió:', 'Esto es lo que dijo Claude:', 'Mensaje de Claude:'],
    // the demo's second half, one line before each trick
    showcase: {
      minds: 'Aquí dentro hay mucha gente.',
      zap: '¿Yo? ¿Una amenaza?',
      possess: 'Esta ventana ahora es mía.',
      sleep: 'Una siestecita…',
      chip: 'Ctrl+Alt+C y me guardo aquí.',
      end: 'Fin de la demo. Te toca, choom.',
    },
    status: 'Claude lleva {time} trabajando en {project}.',
    last: 'Última acción: {action}',
    sessions: '{count} sesiones activas',
    units: { action: ['acción', 'acciones'], file: ['archivo cambiado', 'archivos cambiados'] },
    hooksOk: 'Hooks instalados. Reinicia Claude Code y lo veré todo.',
    hooksRemoved: 'Hooks quitados. Ya no veo a Claude.',
    hooksFail: 'No pude tocar los hooks: {error}',
    // by the hour, at the start of a session
    timeOfDay: {
      morning: ['Buenos días, choom. ¿Café primero?', 'Mañana nueva, código nuevo. Vigilo {project}.', 'Arriba. Night City ya está despierta.'],
      afternoon: ['Buenas tardes, choom. ¿Qué rompemos hoy?', 'Tarde de trabajo en {project}. Aquí estoy.'],
      night: ['Buenas noches, choom. Las luces de la ciudad ya están encendidas.', 'Turno de noche en {project}. Mi favorito.'],
      late: ['¿A estas horas y seguimos? Night City nunca duerme… tú deberías.', 'Madrugada. Solo tú, yo y el satélite.'],
    },
    lateNight: ['Es tarde, choom. Uno más y a dormir, ¿vale?', 'Madrugada otra vez. Yo no me canso, pero tú sí.'],
    // after a command that went well
    commands: {
      push: ['Subido al Net. Preem.', 'Push hecho. Ya está ahí fuera.'],
      commit: ['Commit firmado.', 'Otro commit al historial.'],
      tests: ['Tests en verde. Preem.', 'Todo pasa. Ni un fallo.'],
      system: ['Sistema actualizado. Crucemos los dedos.', 'Paquetes al día.'],
      docker: ['Contenedores arriba.', 'La flota de contenedores está lista.'],
      deps: ['Dependencias instaladas.', 'Piezas nuevas en el sistema.'],
      build: ['Compilado. Sin chispas.', 'Build terminado.'],
    },
    love: ['Esto es para ti, choom.', 'No se lo digas a nadie.', 'Decenas de mentes, y todas para ti.'],
    pet: ['…no me toques el pelo.', 'Mmh. Vale, un poco más.', 'Somos decenas aquí dentro, y todas nos sonrojamos.'],
    noSeat: 'No hay ventana donde sentarme: necesito sitio encima de ella.',
    verbs: {
      Read: 'Lee', Write: 'Escribe', Edit: 'Edita', MultiEdit: 'Edita', NotebookEdit: 'Edita',
      Bash: 'Ejecuta', PowerShell: 'Ejecuta', Grep: 'Busca', Glob: 'Rastrea', WebFetch: 'Consulta',
      WebSearch: 'Investiga', Agent: 'Delega', Task: 'Delega', TodoWrite: 'Planifica', Skill: 'Carga',
      AskUserQuestion: 'Pregunta', ExitPlanMode: 'Propone', default: 'Usa',
    },
  },

  en: {
    state: { work: 'RUNNING', done: 'DONE', alert: 'WAITING', error: 'ERROR', info: 'SYNC', idle: 'IDLE' },
    hello: [
      'Link established. Hey, choom.',
      'Capricorn construct online. What are we building?',
      'All of me is awake. Watching {project}.',
      'Biochip warm. I’m here.',
    ],
    resume: ['Back on {project}. I didn’t forget a thing.', 'Session resumed. Picking up where we left off.'],
    prompt: [
      'New gig. Claude’s on it.',
      'Got it. I’m keeping an eye on Claude.',
      'Okay, let’s go.',
      'Gig accepted. I’ll keep you posted.',
    ],
    working: [
      'Moving along. {count} actions so far.',
      'Claude’s grinding. I’m counting: {count}.',
      'Still on it. {count} actions on the clock.',
    ],
    done: [
      'Done! That’s preem.',
      'Gig complete, choom.',
      'Claude’s finished. You can come back.',
      'Delivered. Pretty nova, right?',
      'Finished. Dozens of us watching, nothing looked off.',
    ],
    permission: ['Hey! Claude needs your permission.', 'Choom, you need to approve something.', 'Waiting on your green light.'],
    waiting: ['Claude is waiting for your answer.', 'Your move, choom.'],
    error: ['Ouch. {tool} crashed.', '{tool} flatlined. Claude will retry.', '{tool} failed. Nothing serious… I think.'],
    interrupted: ['Interrupted. Change of plans?', 'Cut off. I’ll stay put.'],
    crashed: ['Claude stopped mid-flight.', 'Hard crash. Claude couldn’t finish.'],
    subagentStart: ['Subagent {agent} deployed.'],
    subagentStop: ['Subagent {agent} is back.'],
    compact: ['Compressing our memories…', 'Too much memory. Tidying up.'],
    bye: ['Session {project} closed. Later.', 'Disconnected. I’ll be around.'],
    idle: ['Nothing running. Just floating.', 'No gig. Kinda bored.', 'Quiet night on the Net.'],
    gaze: ['See that star?', 'The satellite’s still up there.', 'Shh. I’m watching.'],
    uplink: ['Someday I’ll get up there.', 'Think we could make it up there?', 'It answered. Did you see?'],
    // over Claude's whole answer, when you weren't on its window
    reply: ['Claude answered:', 'Here’s what Claude said:', 'Message from Claude:'],
    // the demo's second half, one line before each trick
    showcase: {
      minds: 'There’s a crowd in here.',
      zap: 'Me? A menace?',
      possess: 'This window’s mine now.',
      sleep: 'Quick nap…',
      chip: 'Ctrl+Alt+C, and I tuck myself away here.',
      end: 'That’s the demo. Your turn, choom.',
    },
    status: 'Claude has been working on {project} for {time}.',
    last: 'Last action: {action}',
    sessions: '{count} active sessions',
    units: { action: ['action', 'actions'], file: ['file changed', 'files changed'] },
    hooksOk: 'Hooks installed. Restart Claude Code and I’ll see everything.',
    hooksRemoved: 'Hooks removed. I can’t see Claude anymore.',
    hooksFail: 'Couldn’t change the hooks: {error}',
    // by the hour, at the start of a session
    timeOfDay: {
      morning: ['Morning, choom. Coffee first?', 'New morning, new code. Watching {project}.', 'Up. Night City’s awake already.'],
      afternoon: ['Afternoon, choom. What are we breaking today?', 'Afternoon shift on {project}. I’m here.'],
      night: ['Evening, choom. The city lights are on.', 'Night shift on {project}. My favourite.'],
      late: ['This late and still at it? Night City never sleeps… you should.', 'Small hours. Just you, me and the satellite.'],
    },
    lateNight: ['It’s late, choom. One more and bed, deal?', 'Small hours again. I don’t get tired, you do.'],
    // after a command that went well
    commands: {
      push: ['Pushed to the Net. Preem.', 'Push done. It’s out there.'],
      commit: ['Commit signed.', 'Another one for the history.'],
      tests: ['Tests are green. Preem.', 'All passing. Not one failure.'],
      system: ['System updated. Fingers crossed.', 'Packages up to date.'],
      docker: ['Containers are up.', 'The container fleet is ready.'],
      deps: ['Dependencies installed.', 'New parts in the system.'],
      build: ['Built. No sparks.', 'Build done.'],
    },
    love: ['This one’s for you, choom.', 'Don’t tell anyone.', 'Dozens of minds, and all of them for you.'],
    pet: ['…don’t touch my hair.', 'Mmh. Fine, a little more.', 'There are dozens of us in here, and we’re all blushing.'],
    noSeat: 'No window to sit on: I need room above one.',
    verbs: {
      Read: 'Reads', Write: 'Writes', Edit: 'Edits', MultiEdit: 'Edits', NotebookEdit: 'Edits',
      Bash: 'Runs', PowerShell: 'Runs', Grep: 'Greps', Glob: 'Scans', WebFetch: 'Fetches',
      WebSearch: 'Searches', Agent: 'Delegates', Task: 'Delegates', TodoWrite: 'Plans', Skill: 'Loads',
      AskUserQuestion: 'Asks', ExitPlanMode: 'Proposes', default: 'Uses',
    },
  },
};
