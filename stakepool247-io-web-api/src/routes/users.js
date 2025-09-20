import { Router } from "express";
import { body, validationResult } from "express-validator";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { loadOwnUser } from "../middleware/user.js";
import { botNotificationsQueue } from '../config/queue.js'

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  getFirestore('stakepool247-v2')
    .collection("users")
    .get()
    .then((users) => {
      res.json(users.docs.map((user) => ({ ...user.data(), id: user.id })));
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(404).json();
    });
});

router.post(
  "/",
  body("email").isEmail(),
  body("displayName").isString(),
  body("uid").isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    getFirestore('stakepool247-v2')
      .collection("users")
      .doc(req.body.uid)
      .create({
        email: req.body.email,
        displayName: req.body.displayName,
      })
      .then(() => {
        res.status(201).json();
      })
      .catch((error) => {
        console.error(error);
        res.sendStatus(500).json();
      });
  }
);

router.put(
  "/me",
  requireAuth,
  body("photoUrl").optional().isString(),
  body("photoUrlDisplay").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {};
    if (req.body.photoUrl) {
      updateData["photoUrl"] = req.body.photoUrl;
    }
    if (req.body.photoUrlDisplay) {
      updateData["photoUrlDisplay"] = req.body.photoUrlDisplay;
    }
    if (req.body.telegramData) {
      updateData["telegramData"] = req.body.telegramData;
    }
    getFirestore('stakepool247-v2')
      .collection("users")
      .doc(req.uid)
      .update(updateData)
      .then(() => {
        res.status(200).json();
        if (req.body.telegramData) {
          botNotificationsQueue.add({
            receivers: {
                chats: [req.body.telegramData.id]
            },
            type: 'alert',
            data: {
                message: "Successfully authenticated"
            }
          })
        }
      })
      .catch((error) => {
        console.error(error);
        res.status(500).json();
      });
  }
);

router.delete("/me/telegramData", requireAuth, loadOwnUser, async (req, res) => {
  getFirestore('stakepool247-v2')
    .collection("users")
    .doc(req.uid)
    .update({telegramData: FieldValue.delete()})
    .then(() => {
      res.status(200).json()
    }).catch((error) => {
      console.error(error);
      res.status(500).json();
    })
});

router.get("/me", requireAuth, loadOwnUser, async (req, res) => {
  res.json(req.user);
});

router.get("/:userId", requireAdmin, async (req, res) => {
  getFirestore('stakepool247-v2')
    .collection("users")
    .doc(req.params.userId)
    .get()
    .then((user) => {
      res.json(user.data());
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(404).json();
    });
});

export default router;
