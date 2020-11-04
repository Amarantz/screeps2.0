Object.defineProperty(RoomObject.prototype, "ref", {
  // reference object; see globals.deref (which includes Creep)
  get() {
    return this.id || this.name || "";
  },
  configurable: true
});

Object.defineProperty(RoomObject.prototype, "targetedBy", {
  // List of creep names with tasks targeting this object
  get() {
    return BigBrain.cache.targets[this.ref] || [];
  },
  configurable: true
});

RoomObject.prototype.serialize = function (): ProtoRoomObject {
  const pos: ProtoPos = {
    x: this.pos.x,
    y: this.pos.y,
    roomName: this.pos.roomName
  };
  return {
    pos,
    ref: this.ref
  };
};
