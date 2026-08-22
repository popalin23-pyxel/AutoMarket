// i18n minimale: dizionario IT/EN + contesto React.

import React, { createContext, useContext } from 'react';

export const MONTHS = {
  it: ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};
export const WEEKDAYS = {
  it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],
  en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
};

const DICT = {
  it: {
    'app.subtitle': 'Generatore automatico di turni per il personale',
    'app.footer': 'Turnify Web — i dati sono salvati solo in questo browser. Nessun server.',
    'tab.staff': 'Personale', 'tab.shifts': 'Turni', 'tab.rules': 'Regole',
    'tab.unav': 'Indisponibilità', 'tab.generate': 'Genera & Export', 'tab.data': 'Dati',

    'c.add': 'Aggiungi', 'c.delete': 'Elimina', 'c.save': 'Salva', 'c.yes': 'Sì', 'c.no': 'No',
    'c.name': 'Nome', 'c.role': 'Ruolo', 'c.day': 'Giorno', 'c.type': 'Tipo', 'c.hours': 'Ore',
    'c.period': 'Periodo', 'c.person': 'Persona',

    'staff.desc': 'Aggiungi il personale e assegna un ruolo. Le ore contrattuali (mensili) bilanciano il carico tra part-time e full-time; il turno preferito è usato come preferenza quando possibile.',
    'staff.namePh': 'Es. Maria Rossi',
    'staff.hoursMonth': 'Ore/mese', 'staff.hoursPh': '0 = auto',
    'staff.preferred': 'Turno preferito', 'staff.preferredShort': 'Preferito',
    'staff.floors': 'Piani', 'staff.floorsAll': 'Tutti i piani',
    'staff.startShift': 'Inizio rotazione', 'staff.auto': 'Auto',
    'staff.empty': 'Nessun membro del personale. Aggiungine uno sopra.',
    'staff.pref.none': '—', 'staff.pref.M': 'Mattina', 'staff.pref.P': 'Pomeriggio', 'staff.pref.N': 'Notte',

    'shifts.desc': "Definisci i codici turno, le ore e se sono lavorativi o notturni. Sono usati nella generazione e nell'export.",
    'shifts.code': 'Codice', 'shifts.description': 'Descrizione', 'shifts.working': 'Lavorativo', 'shifts.night': 'Notte',
    'shifts.codePh': 'M', 'shifts.descPh': 'Mattina', 'shifts.addUpdate': 'Aggiungi / Aggiorna',

    'rules.title': 'Regole di generazione',
    'rules.desc': 'Questi vincoli vengono applicati durante la generazione automatica del planning.',
    'rules.maxNights': 'Max notti / mese', 'rules.maxStreak': 'Max giorni consecutivi',
    'rules.altMP': 'Alterna Mattina / Pomeriggio', 'rules.on': 'Attiva', 'rules.off': 'Disattiva',
    'rules.autosave': 'Le modifiche sono salvate automaticamente e usate al prossimo "Genera turni".',
    'rules.coverage': 'Copertura richiesta',
    'rules.coverageDesc': 'Per ogni piano, quante persone servono per ruolo e per turno, distinguendo feriali da weekend/festivi. La generazione copre questi numeri e segnala i turni scoperti.',
    'rules.shift': 'Turno', 'rules.weekday': 'Feriale', 'rules.weekend': 'Weekend / Festivi',
    'rules.weekdayShort': 'Fer', 'rules.weekendShort': 'Wk',
    'rules.floors': 'Piani / Reparti',
    'rules.floorsDesc': 'Aggiungi i piani della struttura. Ogni persona può coprire uno o più piani.',
    'rules.addFloor': 'Aggiungi piano', 'rules.newFloorPh': 'Es. Piano 3', 'rules.floor': 'Piano',
    'rules.coverageHours': 'Copertura in ore (per ruolo)',
    'rules.coverageHoursDesc': 'Ore di lavoro necessarie ogni giorno per ruolo, per piano. Usate nella modalità “Fabbisogno ore”. 0 = non usata.',
    'rules.hWeekday': 'Ore feriale', 'rules.hWeekend': 'Ore weekend',
    'rules.sequences': 'Sequenze turni per ruolo',
    'rules.sequencesDesc': 'Ordine ciclico dei turni per ogni ruolo (es. P M N S R). Usato nella modalità “Rotazione” e come priorità in “Fabbisogno ore”. Separa i codici con spazi.',
    'rules.rolesTitle': 'Ruoli e turni ammessi',
    'rules.rolesDesc': 'Spunta i turni che ogni ruolo può ricevere. Un ruolo senza turni diurni lavorativi verrà messo a riposo.',
    'rules.newRole': 'Nuovo ruolo', 'rules.newRolePh': 'Es. Caposala', 'rules.addRole': 'Aggiungi ruolo',

    'unav.desc': 'Registra ferie, malattie e permessi. Nei giorni indicati il personale sarà messo a riposo.',
    'unav.needStaff': 'Aggiungi prima del personale nella scheda "Personale".',
    'unav.empty': 'Nessuna indisponibilità registrata.',
    'unav.ferie': 'Ferie', 'unav.malattia': 'Malattia', 'unav.permesso': 'Permesso', 'unav.indisp': 'Indisponibilità',

    'gen.title': 'Genera & Export',
    'gen.desc': 'Genera il planning mensile rispettando la copertura richiesta e le regole. Poi puoi modificare a mano ogni cella (tap/clic per cambiare turno) ed esportare in Excel.',
    'gen.month': 'Mese', 'gen.year': 'Anno',
    'gen.mode': 'Modalità', 'gen.modeCount': 'Persone', 'gen.modeHours': 'Fabbisogno ore', 'gen.modeRotation': 'Rotazione',
    'gen.deficitHoursPre': 'ruoli sotto le ore richieste in', 'gen.hoursUnit': 'h',
    'gen.generate': 'Genera turni', 'gen.excel': 'Esporta Excel', 'gen.saveHist': 'Salva nello storico',
    'gen.needStaff': 'Aggiungi del personale prima di generare il planning.',
    'gen.deficitPre': 'turni sotto-copertura in', 'gen.deficitDays': 'giorni.',
    'gen.details': 'Dettagli', 'gen.hide': 'Nascondi',
    'gen.covOK': '✓ Copertura completa per tutti i giorni.',
    'gen.print': '🖨 Stampa / PDF', 'gen.calPerson': 'Calendario personale:',
    'gen.people': 'Persone', 'gen.totHours': 'Ore totali', 'gen.nights': 'Notti', 'gen.rests': 'Riposi',
    'gen.colName': 'Nome', 'gen.colHours': 'Ore', 'gen.holiday': 'Festivo', 'gen.changeShift': 'Clic per cambiare turno',
    'gen.floor': 'Piano',
    'gen.editTitle': 'Modifica turno', 'gen.editShift': 'Turno', 'gen.editFloor': 'Piano',
    'gen.editCover': 'Copri con (liberi):', 'gen.close': 'Chiudi', 'gen.clear': 'Riposo',
    'gen.analysis': 'Analisi & Equità', 'gen.coverStrip': 'Copertura per giorno',
    'gen.perPerson': 'Carico per persona', 'gen.wk': 'we',
    'gen.fill': '✨ Riempi buchi', 'gen.balance': '⚖ Bilancia', 'gen.undo': '↶ Annulla',
    'gen.wallboard': '📺 Vista muro', 'gen.qr': 'QR', 'gen.today': 'Oggi', 'gen.tomorrow': 'Domani',
    'gen.command': 'Comando rapido', 'gen.commandPh': 'es. Anna R 15  ·  Bruno N 20',
    'gen.compliance': 'Conformità', 'gen.restViol': 'riposo &lt;11h', 'gen.weekViol': 'ore settimana',
    'gen.histTitle': 'Storico planning',
    'gen.histDesc': '“Riapri” lo carica nella griglia per rivederlo, modificarlo o riesportarlo.',
    'gen.savedAt': 'Salvato il', 'gen.reopen': 'Riapri', 'gen.promptName': 'Nome del planning da salvare:',

    'data.title': 'Dati & Backup',
    'data.desc': 'I dati sono salvati solo in questo dispositivo. Usa il backup per spostarli su un altro dispositivo (es. dal PC al telefono) o per tenerne una copia di sicurezza.',
    'data.staff': 'Personale', 'data.shifts': 'Turni', 'data.roles': 'Ruoli', 'data.unav': 'Indisponibilità',
    'data.export': '⬇ Esporta backup (.json)', 'data.import': '⬆ Importa backup', 'data.reset': 'Azzera tutti i dati',
    'data.resetConfirm': 'Sicuro di voler cancellare TUTTI i dati (personale, turni, regole, indisponibilità)? Operazione irreversibile.',
    'data.resetDone': 'Tutti i dati sono stati azzerati.',
    'data.moveHint': 'Come spostare i dati sul telefono:',
    'data.moveHintBody': 'sul PC premi “Esporta backup”, invia il file al telefono (email/WhatsApp/cloud), aprilo qui con “Importa backup”. L’importazione sostituisce i dati attuali su questo dispositivo.',
    'data.cloudTitle': 'Sincronizzazione cloud (opzionale)',
    'data.cloudDesc': 'Tieni i dati sincronizzati tra più dispositivi tramite un progetto Supabase gratuito. Inserisci URL e chiave anon e un codice team condiviso. Stato:',
    'data.cloudConfigured': 'configurato', 'data.cloudNot': 'non configurato',
    'data.cloudTeam': 'Codice team', 'data.cloudPush': '☁ Salva sul cloud', 'data.cloudPull': '⬇ Carica dal cloud',
    'data.cloudAuto': 'Carica automaticamente all’avvio',
    'data.cloudSetup': 'Come configurare Supabase (una volta sola)',
    'lang.label': 'Lingua',
  },
  en: {
    'app.subtitle': 'Automatic staff shift generator',
    'app.footer': 'Turnify Web — data is stored only in this browser. No server.',
    'tab.staff': 'Staff', 'tab.shifts': 'Shifts', 'tab.rules': 'Rules',
    'tab.unav': 'Time off', 'tab.generate': 'Generate & Export', 'tab.data': 'Data',

    'c.add': 'Add', 'c.delete': 'Delete', 'c.save': 'Save', 'c.yes': 'Yes', 'c.no': 'No',
    'c.name': 'Name', 'c.role': 'Role', 'c.day': 'Day', 'c.type': 'Type', 'c.hours': 'Hours',
    'c.period': 'Period', 'c.person': 'Person',

    'staff.desc': 'Add staff and assign a role. Monthly contract hours balance the load between part-time and full-time; the preferred shift is used as a preference when possible.',
    'staff.namePh': 'e.g. Jane Doe',
    'staff.hoursMonth': 'Hours/month', 'staff.hoursPh': '0 = auto',
    'staff.preferred': 'Preferred shift', 'staff.preferredShort': 'Preferred',
    'staff.floors': 'Floors', 'staff.floorsAll': 'All floors',
    'staff.startShift': 'Rotation start', 'staff.auto': 'Auto',
    'staff.empty': 'No staff yet. Add one above.',
    'staff.pref.none': '—', 'staff.pref.M': 'Morning', 'staff.pref.P': 'Afternoon', 'staff.pref.N': 'Night',

    'shifts.desc': 'Define shift codes, hours and whether they are working or night shifts. Used in generation and export.',
    'shifts.code': 'Code', 'shifts.description': 'Description', 'shifts.working': 'Working', 'shifts.night': 'Night',
    'shifts.codePh': 'M', 'shifts.descPh': 'Morning', 'shifts.addUpdate': 'Add / Update',

    'rules.title': 'Generation rules',
    'rules.desc': 'These constraints are applied during automatic schedule generation.',
    'rules.maxNights': 'Max nights / month', 'rules.maxStreak': 'Max consecutive days',
    'rules.altMP': 'Alternate Morning / Afternoon', 'rules.on': 'On', 'rules.off': 'Off',
    'rules.autosave': 'Changes are saved automatically and used on the next "Generate".',
    'rules.coverage': 'Required coverage',
    'rules.coverageDesc': 'Per floor, how many people each role and shift needs, distinguishing weekdays from weekends/holidays. Generation meets these numbers and flags uncovered shifts.',
    'rules.shift': 'Shift', 'rules.weekday': 'Weekday', 'rules.weekend': 'Weekend / Holidays',
    'rules.weekdayShort': 'Wd', 'rules.weekendShort': 'We',
    'rules.floors': 'Floors / Units',
    'rules.floorsDesc': 'Add the floors of your facility. Each person can cover one or more floors.',
    'rules.addFloor': 'Add floor', 'rules.newFloorPh': 'e.g. Floor 3', 'rules.floor': 'Floor',
    'rules.coverageHours': 'Coverage in hours (per role)',
    'rules.coverageHoursDesc': 'Working hours needed each day per role, per floor. Used in “Hours” mode. 0 = not used.',
    'rules.hWeekday': 'Weekday hours', 'rules.hWeekend': 'Weekend hours',
    'rules.sequences': 'Shift sequences per role',
    'rules.sequencesDesc': 'Cyclic order of shifts for each role (e.g. P M N S R). Used in “Rotation” mode and as priority in “Hours” mode. Separate codes with spaces.',
    'rules.rolesTitle': 'Roles and allowed shifts',
    'rules.rolesDesc': 'Check which shifts each role can receive. A role with no working day shifts will be set to rest.',
    'rules.newRole': 'New role', 'rules.newRolePh': 'e.g. Head nurse', 'rules.addRole': 'Add role',

    'unav.desc': 'Record holidays, sick leave and time off. On those days staff will be set to rest.',
    'unav.needStaff': 'Add staff first in the "Staff" tab.',
    'unav.empty': 'No time off recorded.',
    'unav.ferie': 'Holiday', 'unav.malattia': 'Sick', 'unav.permesso': 'Leave', 'unav.indisp': 'Unavailable',

    'gen.title': 'Generate & Export',
    'gen.desc': 'Generate the monthly schedule respecting required coverage and rules. Then you can edit each cell by hand (tap/click to change shift) and export to Excel.',
    'gen.month': 'Month', 'gen.year': 'Year',
    'gen.mode': 'Mode', 'gen.modeCount': 'People', 'gen.modeHours': 'Hours', 'gen.modeRotation': 'Rotation',
    'gen.deficitHoursPre': 'roles below required hours across', 'gen.hoursUnit': 'h',
    'gen.generate': 'Generate', 'gen.excel': 'Export Excel', 'gen.saveHist': 'Save to history',
    'gen.needStaff': 'Add staff before generating the schedule.',
    'gen.deficitPre': 'under-covered shifts across', 'gen.deficitDays': 'days.',
    'gen.details': 'Details', 'gen.hide': 'Hide',
    'gen.covOK': '✓ Full coverage on all days.',
    'gen.print': '🖨 Print / PDF', 'gen.calPerson': 'Personal calendar:',
    'gen.people': 'People', 'gen.totHours': 'Total hours', 'gen.nights': 'Nights', 'gen.rests': 'Rests',
    'gen.colName': 'Name', 'gen.colHours': 'Hours', 'gen.holiday': 'Holiday', 'gen.changeShift': 'Click to change shift',
    'gen.floor': 'Floor',
    'gen.editTitle': 'Edit shift', 'gen.editShift': 'Shift', 'gen.editFloor': 'Floor',
    'gen.editCover': 'Cover with (free):', 'gen.close': 'Close', 'gen.clear': 'Rest',
    'gen.analysis': 'Analytics & Fairness', 'gen.coverStrip': 'Coverage by day',
    'gen.perPerson': 'Load per person', 'gen.wk': 'we',
    'gen.fill': '✨ Fill gaps', 'gen.balance': '⚖ Balance', 'gen.undo': '↶ Undo',
    'gen.wallboard': '📺 Wallboard', 'gen.qr': 'QR', 'gen.today': 'Today', 'gen.tomorrow': 'Tomorrow',
    'gen.command': 'Quick command', 'gen.commandPh': 'e.g. Anna R 15  ·  Bruno N 20',
    'gen.compliance': 'Compliance', 'gen.restViol': 'rest &lt;11h', 'gen.weekViol': 'weekly hours',
    'gen.histTitle': 'Schedule history',
    'gen.histDesc': '“Reopen” loads it into the grid to review, edit or re-export it.',
    'gen.savedAt': 'Saved at', 'gen.reopen': 'Reopen', 'gen.promptName': 'Name of the schedule to save:',

    'data.title': 'Data & Backup',
    'data.desc': 'Data is stored only on this device. Use backup to move it to another device (e.g. from PC to phone) or to keep a safe copy.',
    'data.staff': 'Staff', 'data.shifts': 'Shifts', 'data.roles': 'Roles', 'data.unav': 'Time off',
    'data.export': '⬇ Export backup (.json)', 'data.import': '⬆ Import backup', 'data.reset': 'Erase all data',
    'data.resetConfirm': 'Really erase ALL data (staff, shifts, rules, time off)? This cannot be undone.',
    'data.resetDone': 'All data has been erased.',
    'data.moveHint': 'How to move data to your phone:',
    'data.moveHintBody': 'on the PC press “Export backup”, send the file to your phone (email/WhatsApp/cloud), open it here with “Import backup”. Importing replaces the current data on this device.',
    'data.cloudTitle': 'Cloud sync (optional)',
    'data.cloudDesc': 'Keep data in sync across devices via a free Supabase project. Enter URL, anon key and a shared team code. Status:',
    'data.cloudConfigured': 'configured', 'data.cloudNot': 'not configured',
    'data.cloudTeam': 'Team code', 'data.cloudPush': '☁ Save to cloud', 'data.cloudPull': '⬇ Load from cloud',
    'data.cloudAuto': 'Load automatically on startup',
    'data.cloudSetup': 'How to set up Supabase (one time)',
    'lang.label': 'Language',
  },
};

const I18nContext = createContext('it');

export function I18nProvider({ lang, children }) {
  return React.createElement(I18nContext.Provider, { value: lang === 'en' ? 'en' : 'it' }, children);
}

export function useLang() { return useContext(I18nContext); }

export function useT() {
  const lang = useContext(I18nContext);
  return (key) => DICT[lang]?.[key] ?? DICT.it[key] ?? key;
}

export function monthsFor(lang) { return MONTHS[lang === 'en' ? 'en' : 'it']; }
export function weekdaysFor(lang) { return WEEKDAYS[lang === 'en' ? 'en' : 'it']; }
