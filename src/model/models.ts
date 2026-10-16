import registry from './models.json' with { type: 'json' };
export const MODELS = registry;
export const models = MODELS;
export const getModel = (slug: string) => MODELS.find(model => model.slug === slug);
