import * as assert from "node:assert/strict";
import {
  normalizeObservation,
  type ObservationGameLike,
  type ObservationPlayerLike,
  type ObservationConfigLike,
  type ObservationUnitLike,
} from "../browser/page-adapter/ObservationAdapter";

function createConfig(): ObservationConfigLike {
  return {
    gameConfig: () => ({}),
    numSpawnPhaseTurns: () => 10,
    spawnImmunityDuration: () => 20,
    disableAlliances: () => false,
    waterNukes: () => false,
    isRandomSpawn: () => false,
    unitInfo: () => ({}),
  };
}

function createPlayer(args: {
  id: string;
  clientID: string | null;
  team?: string | null;
  hasSpawned?: boolean;
  alive?: boolean;
}): ObservationPlayerLike {
  return {
    id: () => args.id,
    clientID: () => args.clientID,
    smallID: () => 1,
    name: () => args.id,
    displayName: () => args.id,
    type: () => "HUMAN",
    team: () => args.team ?? null,
    isAlive: () => args.alive ?? true,
    hasSpawned: () => args.hasSpawned ?? true,
    isDisconnected: () => false,
    isTraitor: () => false,
    isLobbyCreator: () => false,
    numTilesOwned: () => 3,
    troops: () => 9,
    gold: () => 100,
    allies: () => [],
    targets: () => [],
    alliances: () => [],
    isAlliedWith: () => false,
    isOnSameTeam: () => false,
    isFriendly: () => false,
    hasEmbargoAgainst: () => false,
    units: (..._types) => [],
  };
}

function createGame(args: {
  players: ObservationPlayerLike[];
  myPlayer: ObservationPlayerLike | null;
  myClientID: string | undefined;
}): ObservationGameLike {
  return {
    config: () => createConfig(),
    players: () => args.players,
    units: (..._types: string[]) => [] as ObservationUnitLike[],
    width: () => 1,
    height: () => 1,
    x: () => 0,
    y: () => 0,
    ticks: () => 42,
    inSpawnPhase: () => false,
    myPlayer: () => args.myPlayer,
    myClientID: () => args.myClientID,
  };
}

async function main(): Promise<void> {
  const staleMyPlayer = createPlayer({
    id: "eliminated-player",
    clientID: "me-client",
    alive: false,
  });
  const survivingCapturedIdentity = createPlayer({
    id: "captor-player",
    clientID: "me-client",
    alive: true,
  });

  const observation = await normalizeObservation(
    createGame({
      players: [survivingCapturedIdentity],
      myPlayer: staleMyPlayer,
      myClientID: "me-client",
    }),
  );

  assert.equal(
    observation.ownPlayer?.playerId,
    "captor-player",
    "observation should resolve own player from authoritative player list when renderer myPlayer is stale",
  );

  console.log("capture/takeover own-player resolution check passed");
}

void main();
