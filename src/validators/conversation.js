import Joi from 'joi';

export const validateConversation = (data, isUpdate = false) => {
  const schema = Joi.object({
    name: Joi.string().max(255),
    model_id: Joi.string().uuid(),
    user_profile_id: Joi.string().uuid(),
    character_id: Joi.string().uuid(),
    character_mood: Joi.string().max(100),
    prompt_wrapper_id: Joi.string().uuid(),
    response_tone_id: Joi.string().uuid(),
    response_setting_id: Joi.string().uuid(),
    inference_preset_id: Joi.string().uuid(),
    fork_from_conversation_id: Joi.string().uuid(),
    fork_from_message_id: Joi.string().uuid(),
    is_synthetic: Joi.boolean()
  });
  
  return schema.validate(data);
};