/**
 * Template structure tests: the declarative form drives the UI (steps,
 * sections and the custom map field), the states machine drives the
 * lifecycle, and both must stay consistent.
 */
import { windbreakTemplate, windbreakForm, windbreakSteps } from '../src/form';
import { canTransition, transition, windbreakStates } from '../src/states';
import { windbreakAnswersSchema } from '../src/dataSchema';
import type { WindbreakApplication } from '../src/types';

function draftApplication(): WindbreakApplication {
  return {
    id: 'app-1',
    typeId: 'windbreak',
    state: 'draft',
    answers: { lines: [] },
    createdAt: '2026-01-01T00:00:00Z',
    modifiedAt: '2026-01-01T00:00:00Z',
  };
}

describe('windbreakTemplate', () => {
  it('is the windbreak type with schema, states, steps and form', () => {
    expect(windbreakTemplate.id).toBe('windbreak');
    expect(windbreakTemplate.typeId).toBe('windbreak');
    expect(windbreakTemplate.name).toMatchObject({
      en: expect.any(String),
      is: expect.any(String),
    });
    expect(windbreakTemplate.states).toEqual(windbreakStates);
    expect(windbreakTemplate.dataSchema).toBe(windbreakAnswersSchema);
    expect(windbreakTemplate.steps).toBe(windbreakSteps);
    expect(windbreakTemplate.form).toBe(windbreakForm);
  });
});

describe('windbreakForm', () => {
  it('renders draw then review, both with the custom map field', () => {
    expect(windbreakForm.sections.map((s) => s.id)).toEqual(['draw', 'review']);
    for (const section of windbreakForm.sections) {
      expect(section.fields.length).toBeGreaterThan(0);
      for (const field of section.fields) {
        expect(field.type).toBe('windbreakLines');
        expect(field.id).toBe('lines');
        expect(field.mode).toBe(section.id);
      }
    }
  });

  it('points at message ids in the template catalog', () => {
    for (const step of windbreakSteps) {
      expect(step.labelId).toMatch(/^windbreak\./);
    }
    for (const section of windbreakForm.sections) {
      expect(section.titleId).toMatch(/^windbreak\./);
      expect(section.helpId).toMatch(/^windbreak\./);
    }
  });
});

describe('states', () => {
  it('moves draft -> submitted on SUBMIT', () => {
    const next = transition(draftApplication(), { type: 'SUBMIT' });
    expect(next?.state).toBe('submitted');
  });

  it('does not move an already submitted application', () => {
    const submitted = {
      ...draftApplication(),
      state: 'submitted' as const,
    };
    expect(canTransition(submitted.state, { type: 'SUBMIT' })).toBe(false);
    expect(transition(submitted, { type: 'SUBMIT' })).toBeNull();
  });
});
