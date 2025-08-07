import Joi from 'joi';

export const validateCharacter = (data, isUpdate = false) => {
  const schema = Joi.object({
    name: isUpdate 
      ? Joi.string().min(1).max(255)
      : Joi.string().min(1).max(255).required(),
    description: isUpdate
      ? Joi.string().min(1)
      : Joi.string().min(1).required(),
    format_type: Joi.string().valid('plain', 'markdown', 'json'),
    mood_variants: Joi.object().pattern(
      Joi.string(),
      Joi.string()
    ),
    internal_state: Joi.object({
      mood: Joi.string(),
      beliefs: Joi.object(),
      drives: Joi.object()
    }).unknown(true)
  });
  
  return schema.validate(data);
};