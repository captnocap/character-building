import Joi from 'joi';

export const validateMessage = (data, isUpdate = false) => {
  const schema = Joi.object({
    role: isUpdate 
      ? Joi.string().valid('user', 'assistant', 'system', 'tool')
      : Joi.string().valid('user', 'assistant', 'system', 'tool').required(),
    content: isUpdate
      ? Joi.string().min(1)
      : Joi.string().min(1).required(),
    is_ghost: Joi.boolean(),
    ghost_author: Joi.string().max(100),
    rating: Joi.number().integer().min(1).max(5),
    tags: Joi.array().items(Joi.string()),
    usage_stats: Joi.object({
      recalled: Joi.number().integer().min(0),
      ignored: Joi.number().integer().min(0)
    }).unknown(true),
    provenance: Joi.object().unknown(true),
    model_id: Joi.string().uuid(),
    inference_preset_id: Joi.string().uuid(),
    embedding: Joi.array().items(Joi.number())
  });
  
  return schema.validate(data);
};