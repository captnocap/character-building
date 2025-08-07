import Joi from 'joi';

export const validateUserProfile = (data, isUpdate = false) => {
  const schema = Joi.object({
    name: isUpdate 
      ? Joi.string().min(1).max(255)
      : Joi.string().min(1).max(255).required(),
    description: isUpdate
      ? Joi.string().min(1)
      : Joi.string().min(1).required(),
    format_type: Joi.string().valid('plain', 'markdown', 'json')
  });
  
  return schema.validate(data);
};