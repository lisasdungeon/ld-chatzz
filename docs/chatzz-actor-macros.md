# Chatzz Actor Macros

## Send a friend request to the selected token's actor

```js
const actor = canvas.tokens.controlled[0]?.actor;
if (!actor) return ui.notifications.warn("Select a token first.");

await LDChatzz.requestActorFriendship(actor.id, {
  requesterActorId: game.user.character?.id ?? null,
  requesterActorName: game.user.character?.name ?? game.user.name,
  note: "Want to chat?"
});
```

## Open a chat with the selected token's actor

```js
const actor = canvas.tokens.controlled[0]?.actor;
if (!actor) return ui.notifications.warn("Select a token first.");

await UIManager.openChatForActor(actor.id);
```

## Open a chat from an actor directory entry

```js
const actor = game.actors.get("ACTOR_ID_HERE");
if (!actor) return ui.notifications.warn("Actor not found.");

await UIManager.openChatForActor(actor.id);
```
