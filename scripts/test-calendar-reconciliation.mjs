import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../google-apps-script.js', import.meta.url), 'utf8');
const start = source.indexOf('function normalizeCalendarMatchText');
const end = source.indexOf('function driveUploadFolder', start);
assert.ok(start >= 0 && end > start, 'No se localizaron los helpers de reconciliación.');

let sequence = 0;
class MockEvent {
  constructor(title, start, id = `event-${++sequence}`) {
    this.id = id;
    this.title = title;
    this.start = new Date(start);
    this.tags = {};
    this.deleted = false;
    this.guests = [];
  }
  getId() { return this.id; }
  getTitle() { return this.title; }
  getStartTime() { return this.start; }
  getTag(key) { return this.tags[key] || ''; }
  setTag(key, value) { this.tags[key] = value; return this; }
  setTitle(value) { this.title = value; return this; }
  setLocation() { return this; }
  setDescription() { return this; }
  setAllDayDate(value) { this.start = new Date(value); return this; }
  setTime(value) { this.start = new Date(value); return this; }
  removeAllReminders() { return this; }
  addPopupReminder() { return this; }
  getGuestList() { return this.guests.map((email) => ({ getEmail: () => email })); }
  removeGuest(email) { this.guests = this.guests.filter((item) => item !== email); return this; }
  addGuest(email) { if (!this.guests.includes(email)) this.guests.push(email); return this; }
  deleteEvent() { this.deleted = true; }
}

class MockCalendar {
  constructor(events = []) { this.events = events; }
  getEventById(id) { return this.events.find((item) => item.id === id && !item.deleted) || null; }
  getEvents(from, to) { return this.events.filter((item) => !item.deleted && item.start >= from && item.start < to); }
  createEvent(title, start) { const event = new MockEvent(title, start); this.events.push(event); return event; }
  createAllDayEvent(title, start) { return this.createEvent(title, start); }
  active() { return this.events.filter((item) => !item.deleted); }
}

const context = {
  Date,
  String,
  Number,
  Math,
  Utilities: { formatDate: (date) => new Date(date).toISOString().slice(0, 10) },
  businessCalendarTimeZone: () => 'UTC',
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const title = 'XPH · Boda · Cliente Prueba';
const sessionTitle = 'XPH · Sesión previa · Cliente Prueba';
const date = new Date('2026-11-07T14:30:00.000Z');
const canonical = new MockEvent(title, date, 'canonical');
const duplicate = new MockEvent(title, date, 'duplicate');
const legitimateSession = new MockEvent(sessionTitle, date, 'session');
const calendar = new MockCalendar([canonical, duplicate, legitimateSession]);

const first = context.upsertClientCalendarEvent(calendar, canonical.id, title, date, 8, 'Lugar', 'Descripción', '', false, 'client:123:event');
assert.equal(first.eventId, canonical.id);
assert.equal(first.duplicatesDeleted, 1);
assert.equal(calendar.active().length, 2, 'La sesión distinta del mismo cliente no debe eliminarse.');
assert.ok(calendar.getEventById('session'), 'La sesión legítima debe conservarse.');

const second = context.upsertClientCalendarEvent(calendar, canonical.id, title, date, 8, 'Lugar nuevo', 'Descripción', '', false, 'client:123:event');
assert.equal(second.created, 0);
assert.equal(second.duplicatesDeleted, 0);
assert.equal(calendar.active().length, 2, 'Reintentar no debe crear ni borrar más eventos.');

const emptyCalendar = new MockCalendar();
const created = context.upsertClientCalendarEvent(emptyCalendar, '', title, date, 8, '', '', '', false, 'client:456:event');
assert.equal(created.created, 1);
const repeated = context.upsertClientCalendarEvent(emptyCalendar, created.eventId, title, date, 8, '', '', '', false, 'client:456:event');
assert.equal(repeated.created, 0);
assert.equal(emptyCalendar.active().length, 1, 'Crear y reintentar debe conservar un solo evento.');

const removed = context.removeClientCalendarEvent(emptyCalendar, created.eventId, 'client:456:event', title, date);
assert.equal(removed.eventId, '');
assert.equal(emptyCalendar.active().length, 0);

console.log('Calendar reconciliation: 4 escenarios aprobados.');
