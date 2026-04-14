import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { guruMessageSchema } from '../validators/schemas.js';
import * as guruService from '../services/guru.service.js';

const router = Router();
router.use(authenticate);

router.post('/ask', validate(guruMessageSchema), async (req, res, next) => {
  try {
    const response = await guruService.askGuru(req.user.id, req.body.history);
    res.json(response);
  } catch (err) { next(err); }
});

export default router;
