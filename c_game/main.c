#include "raylib.h"
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#define VIRTUAL_W 320
#define VIRTUAL_H 200
#define SCALE 3
#define MAX_SOLIDS 16
#define MAX_EXITS 4
#define MAX_OBJS 8
#define MAX_MESSAGES 10

typedef struct { int x, y, w, h; } RectI;
typedef enum { ROOM_YARD, ROOM_COTTAGE, ROOM_FOREST } RoomId;

typedef struct {
  RectI zone;
  RoomId target;
  Vector2 spawn;
  const char *note;
} ExitZone;

typedef struct {
  const char *id;
  const char *label;
  RectI zone;
  bool active;
} Obj;

typedef struct {
  const char *name;
  Vector2 spawn;
  RectI solids[MAX_SOLIDS];
  int solidCount;
  ExitZone exits[MAX_EXITS];
  int exitCount;
  Obj objs[MAX_OBJS];
  int objCount;
} Room;

typedef struct {
  float x, y;
  int w, h;
  float speed;
  int facing; // 0 down,1 up,2 left,3 right
  float step;
} Player;

typedef struct {
  RoomId room;
  Player p;
  bool hasNote;
  bool hasKey;
  bool gateUnlocked;
  bool hasWood;
  const char *msgs[MAX_MESSAGES];
  int msgCount;
} Game;

typedef struct {
  Texture2D bgYard;
  Texture2D bgCottage;
  Texture2D bgForest;
  Texture2D mainChar;
  Texture2D sprites;
  bool hasYard;
  bool hasCottage;
  bool hasForest;
  bool hasMainChar;
  bool hasSprites;
} Assets;

static const Color PAL_BG0 = {25, 37, 63, 255};
static const Color PAL_BG1 = {62, 84, 126, 255};
static const Color PAL_GRASS0 = {58, 96, 50, 255};
static const Color PAL_GRASS1 = {87, 128, 63, 255};
static const Color PAL_PATH0 = {123, 105, 69, 255};
static const Color PAL_PATH1 = {164, 139, 93, 255};
static const Color PAL_WOOD0 = {95, 63, 33, 255};
static const Color PAL_WOOD1 = {132, 90, 47, 255};
static const Color PAL_STONE0 = {89, 92, 92, 255};
static const Color PAL_STONE1 = {126, 127, 121, 255};
static const Color PAL_WATER0 = {30, 69, 119, 255};
static const Color PAL_WATER1 = {53, 108, 168, 255};
static const Color PAL_SKIN = {220, 183, 137, 255};
static const Color PAL_CLOTH = {141, 94, 55, 255};

static Room gRooms[3];
static Assets gAssets = {0};

static bool Overlap(RectI a, RectI b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

static RectI PlayerRect(Player p) {
  RectI r = {(int)p.x, (int)p.y, p.w, p.h};
  return r;
}

static void PushMsg(Game *g, const char *m) {
  if (g->msgCount < MAX_MESSAGES) {
    for (int i = g->msgCount; i > 0; --i) g->msgs[i] = g->msgs[i - 1];
    g->msgs[0] = m;
    g->msgCount++;
  } else {
    for (int i = MAX_MESSAGES - 1; i > 0; --i) g->msgs[i] = g->msgs[i - 1];
    g->msgs[0] = m;
  }
}

static void DitherRect(int x, int y, int w, int h, Color a, Color b, int step) {
  for (int yy = y; yy < y + h; yy += step) {
    for (int xx = x; xx < x + w; xx += step) {
      DrawRectangle(xx, yy, step, step, (((xx + yy) / step) & 1) ? a : b);
    }
  }
}

static void DrawSkyGround(Color s0, Color s1, Color g0, Color g1) {
  DrawRectangleGradientV(0, 0, VIRTUAL_W, 96, s0, s1);
  DitherRect(0, 88, VIRTUAL_W, VIRTUAL_H - 88, g0, g1, 3);
}

static void DrawYardScene(float t) {
  if (gAssets.hasYard) {
    Rectangle src = {0, 0, (float)gAssets.bgYard.width, (float)gAssets.bgYard.height};
    Rectangle dst = {0, 0, (float)VIRTUAL_W, (float)VIRTUAL_H};
    DrawTexturePro(gAssets.bgYard, src, dst, (Vector2){0, 0}, 0.0f, WHITE);
    if (gAssets.hasSprites) {
      int frame = (((int)(t * 6.0f)) & 1) ? 9 : 8;
      Rectangle hsrc = {(float)(frame * 64 + 6), 6, 52, 44};
      Rectangle hdst = {50, 110, 14, 10};
      DrawTexturePro(gAssets.sprites, hsrc, hdst, (Vector2){0, 0}, 0.0f, WHITE);
    } else {
      bool henFrame = ((int)(t * 6.0f) & 1) == 0;
      DrawRectangle(52, 116, 10, 7, henFrame ? (Color){230, 214, 170, 255} : (Color){214, 193, 142, 255});
      DrawPixel(58, 118, BLACK);
    }
    return;
  }

  DrawSkyGround(PAL_BG0, PAL_BG1, PAL_GRASS0, PAL_GRASS1);
  DitherRect(84, 68, 150, 120, PAL_PATH0, PAL_PATH1, 4);

  DrawRectangle(0, 146, 70, 54, PAL_WATER0);
  DitherRect(4, 150, 62, 46, PAL_WATER0, PAL_WATER1, 4);

  DrawRectangle(10, 36, 80, 54, PAL_STONE1);
  DrawRectangle(6, 24, 88, 20, PAL_WOOD1);
  DrawRectangle(42, 56, 18, 30, PAL_WOOD0);

  DrawRectangle(128, 94, 40, 24, PAL_STONE1);
  DrawRectangle(138, 82, 20, 14, PAL_WOOD1);

  DrawRectangle(250, 32, 52, 30, PAL_STONE0);
  DrawRectangle(260, 40, 32, 18, PAL_WOOD0);

  DrawRectangle(194, 92, 76, 44, (Color){78, 64, 40, 255});

  bool henFrame = ((int)(t * 6.0f) & 1) == 0;
  DrawRectangle(52, 116, 10, 7, henFrame ? (Color){230, 214, 170, 255} : (Color){214, 193, 142, 255});
  DrawPixel(58, 118, BLACK);
}

static void DrawCottageScene(void) {
  if (gAssets.hasCottage) {
    Rectangle src = {0, 0, (float)gAssets.bgCottage.width, (float)gAssets.bgCottage.height};
    Rectangle dst = {0, 0, (float)VIRTUAL_W, (float)VIRTUAL_H};
    DrawTexturePro(gAssets.bgCottage, src, dst, (Vector2){0, 0}, 0.0f, WHITE);
    return;
  }

  DrawSkyGround((Color){51, 34, 24, 255}, (Color){78, 52, 33, 255}, (Color){102, 73, 43, 255}, (Color){130, 92, 52, 255});
  DitherRect(28, 26, 264, 150, (Color){143, 103, 60, 255}, (Color){104, 73, 44, 255}, 4);
  DrawRectangle(22, 20, 78, 30, PAL_WOOD0);
  DrawRectangle(206, 20, 84, 30, PAL_WOOD0);
  DrawRectangle(206, 68, 30, 22, (Color){28, 24, 20, 255});
  DrawRectangle(76, 66, 16, 12, (Color){219, 196, 151, 255});
}

static void DrawForestScene(void) {
  if (gAssets.hasForest) {
    Rectangle src = {0, 0, (float)gAssets.bgForest.width, (float)gAssets.bgForest.height};
    Rectangle dst = {0, 0, (float)VIRTUAL_W, (float)VIRTUAL_H};
    DrawTexturePro(gAssets.bgForest, src, dst, (Vector2){0, 0}, 0.0f, WHITE);
    return;
  }

  DrawSkyGround((Color){58, 77, 80, 255}, (Color){92, 117, 105, 255}, (Color){58, 96, 49, 255}, (Color){83, 122, 61, 255});
  DitherRect(86, 0, 146, 200, PAL_PATH0, PAL_PATH1, 4);
  DrawRectangle(146, 6, 28, 16, PAL_STONE1);
  DrawRectangle(34, 20, 36, 54, (Color){42, 72, 41, 255});
  DrawRectangle(128, 20, 40, 56, (Color){43, 74, 43, 255});
  DrawRectangle(232, 26, 40, 56, (Color){45, 78, 46, 255});
}

static void DrawPlayer(const Game *g) {
  const Player *p = &g->p;
  float yRatio = p->y / (float)VIRTUAL_H;
  float scale = 0.78f + yRatio * 0.40f;
  int w = (int)(p->w * scale);
  int h = (int)(p->h * scale);
  int x = (int)(p->x + p->w / 2 - w / 2);
  int y = (int)(p->y + p->h - h + 1);

  DrawRectangle(x + 4, y + h - 2, w - 8, 2, (Color){0, 0, 0, 80});
  if (gAssets.hasMainChar) {
    // main_char.png layout: 4 columns x 3 rows.
    // row0: down(0-1), up(2-3), row1: right walk, row2: left walk
    const int cellW = 384;
    const int cellH = 341;
    int col = 0;
    int row = 0;
    // Use one stable frame per direction first; add animation back after sheet is verified.
    if (p->facing == 0) { row = 0; col = 0; }
    else if (p->facing == 1) { row = 0; col = 2; }
    else if (p->facing == 2) { row = 2; col = 0; }
    else { row = 1; col = 0; }

    Rectangle src = {(float)(col * cellW + 104), (float)(row * cellH + 36), 176, 270};
    Rectangle dst = {(float)x - 6.0f, (float)y - 20.0f, (float)w + 12.0f, (float)h + 24.0f};
    DrawTexturePro(gAssets.mainChar, src, dst, (Vector2){0, 0}, 0.0f, WHITE);
    return;
  }
  if (gAssets.hasSprites) {
    int frame = (((int)p->step) & 3);
    int row = (p->facing == 2 || p->facing == 3) ? 1 : 0;
    Rectangle src = {(float)(frame * 64 + 8), (float)(row * 64 + 2), 48, 58};
    Rectangle dst = {(float)x - 2.0f, (float)y - 6.0f, (float)w + 4.0f, (float)h + 8.0f};
    if (p->facing == 3) {
      src.x += src.width;
      src.width = -src.width;
    }
    DrawTexturePro(gAssets.sprites, src, dst, (Vector2){0, 0}, 0.0f, WHITE);
    return;
  }
  DrawRectangle(x + 5, y + 2, w - 10, 8, PAL_SKIN);
  DrawRectangle(x + 3, y + 10, w - 6, h - 12, PAL_CLOTH);
  int leg = (((int)p->step) & 1);
  DrawRectangle(x + 3 + leg, y + h - 5, 6, 5, (Color){55, 36, 24, 255});
  DrawRectangle(x + w - 9 - leg, y + h - 5, 6, 5, (Color){55, 36, 24, 255});
  if (p->facing == 2) DrawRectangle(x - 1, y + 14, 4, 6, PAL_WOOD1);
  if (p->facing == 3) DrawRectangle(x + w - 3, y + 14, 4, 6, PAL_WOOD1);
  if (p->facing == 1) DrawRectangle(x + 6, y + 1, w - 12, 2, (Color){72, 51, 33, 255});
  if (p->facing == 0) DrawRectangle(x + 6, y + h - 1, w - 12, 2, (Color){72, 51, 33, 255});
}

static void BuildRooms(void) {
  Room *r;

  r = &gRooms[ROOM_YARD];
  *r = (Room){0};
  r->name = "Cottage Yard";
  r->spawn = (Vector2){100, 130};
  r->solids[r->solidCount++] = (RectI){10, 36, 80, 54};
  r->solids[r->solidCount++] = (RectI){0, 146, 70, 54};
  r->solids[r->solidCount++] = (RectI){126, 92, 42, 30};
  r->solids[r->solidCount++] = (RectI){194, 92, 76, 44};
  r->solids[r->solidCount++] = (RectI){0, 0, VIRTUAL_W, 8};
  r->solids[r->solidCount++] = (RectI){0, VIRTUAL_H - 8, VIRTUAL_W, 8};
  r->solids[r->solidCount++] = (RectI){0, 0, 6, VIRTUAL_H};
  r->solids[r->solidCount++] = (RectI){VIRTUAL_W - 6, 0, 6, VIRTUAL_H};

  r->exits[r->exitCount++] = (ExitZone){(RectI){250, 26, 52, 24}, ROOM_FOREST, (Vector2){280, 120}, "You pass under the stone arch."};
  r->exits[r->exitCount++] = (ExitZone){(RectI){42, 56, 18, 22}, ROOM_COTTAGE, (Vector2){160, 160}, "You enter the cottage."};
  r->objs[r->objCount++] = (Obj){"hen", "Hen", (RectI){52, 116, 12, 10}, true};

  r = &gRooms[ROOM_COTTAGE];
  *r = (Room){0};
  r->name = "Inside Cottage";
  r->spawn = (Vector2){160, 160};
  r->solids[r->solidCount++] = (RectI){0, 0, VIRTUAL_W, 8};
  r->solids[r->solidCount++] = (RectI){0, 0, 8, VIRTUAL_H};
  r->solids[r->solidCount++] = (RectI){VIRTUAL_W - 8, 0, 8, VIRTUAL_H};
  r->solids[r->solidCount++] = (RectI){0, VIRTUAL_H - 8, 120, 8};
  r->solids[r->solidCount++] = (RectI){200, VIRTUAL_H - 8, 120, 8};
  r->solids[r->solidCount++] = (RectI){22, 20, 78, 30};
  r->solids[r->solidCount++] = (RectI){206, 20, 84, 30};
  r->exits[r->exitCount++] = (ExitZone){(RectI){120, VIRTUAL_H - 8, 80, 8}, ROOM_YARD, (Vector2){48, 72}, "You step back into the yard."};
  r->objs[r->objCount++] = (Obj){"note", "Island Note", (RectI){76, 66, 16, 12}, true};

  r = &gRooms[ROOM_FOREST];
  *r = (Room){0};
  r->name = "Forest Path";
  r->spawn = (Vector2){280, 120};
  r->solids[r->solidCount++] = (RectI){0, 0, VIRTUAL_W, 8};
  r->solids[r->solidCount++] = (RectI){0, VIRTUAL_H - 8, VIRTUAL_W, 8};
  r->solids[r->solidCount++] = (RectI){0, 0, 6, VIRTUAL_H};
  r->solids[r->solidCount++] = (RectI){VIRTUAL_W - 6, 0, 6, VIRTUAL_H};
  r->solids[r->solidCount++] = (RectI){34, 20, 36, 54};
  r->solids[r->solidCount++] = (RectI){128, 20, 40, 56};
  r->solids[r->solidCount++] = (RectI){232, 26, 40, 56};
  r->exits[r->exitCount++] = (ExitZone){(RectI){286, 96, 20, 70}, ROOM_YARD, (Vector2){250, 48}, "You return to the yard gate."};
}

static bool IsWalkable(RoomId room, RectI pr) {
  if (pr.x < 0 || pr.y < 0 || pr.x + pr.w > VIRTUAL_W || pr.y + pr.h > VIRTUAL_H) return false;
  Room *r = &gRooms[room];
  for (int i = 0; i < r->solidCount; i++) if (Overlap(pr, r->solids[i])) return false;
  return true;
}

static void SnapToWalkable(Game *g) {
  RectI p = PlayerRect(g->p);
  if (IsWalkable(g->room, p)) return;
  for (int rad = 2; rad < 40; rad += 2) {
    for (int oy = -rad; oy <= rad; oy += 2) {
      for (int ox = -rad; ox <= rad; ox += 2) {
        RectI t = {p.x + ox, p.y + oy, p.w, p.h};
        if (IsWalkable(g->room, t)) {
          g->p.x = (float)t.x;
          g->p.y = (float)t.y;
          return;
        }
      }
    }
  }
}

static void Interact(Game *g) {
  Room *r = &gRooms[g->room];
  RectI probe = {(int)g->p.x - 8, (int)g->p.y - 8, g->p.w + 16, g->p.h + 16};
  for (int i = 0; i < r->objCount; ++i) {
    Obj *o = &r->objs[i];
    if (!o->active) continue;
    if (Overlap(probe, o->zone)) {
      if (strcmp(o->id, "note") == 0) {
        g->hasNote = true;
        o->active = false;
        PushMsg(g, "Picked up: Island Note.");
        PushMsg(g, "'The brass key sleeps where sea kisses stone.'");
        return;
      }
      if (strcmp(o->id, "hen") == 0) {
        PushMsg(g, "Hen: cluck cluck.");
        return;
      }
      PushMsg(g, "Nothing happens.");
      return;
    }
  }
  PushMsg(g, "Nothing useful nearby.");
}

static void UpdateGame(Game *g, float dt) {
  float dx = 0.0f, dy = 0.0f;
  if (IsKeyDown(KEY_W) || IsKeyDown(KEY_UP)) dy -= 1.0f;
  if (IsKeyDown(KEY_S) || IsKeyDown(KEY_DOWN)) dy += 1.0f;
  if (IsKeyDown(KEY_A) || IsKeyDown(KEY_LEFT)) dx -= 1.0f;
  if (IsKeyDown(KEY_D) || IsKeyDown(KEY_RIGHT)) dx += 1.0f;

  if (dx != 0.0f && dy != 0.0f) {
    float n = 1.0f / sqrtf(2.0f);
    dx *= n;
    dy *= n;
  }

  if (dx < 0) g->p.facing = 2;
  if (dx > 0) g->p.facing = 3;
  if (dy < 0) g->p.facing = 1;
  if (dy > 0) g->p.facing = 0;

  float oldX = g->p.x;
  float oldY = g->p.y;
  RectI nx = {(int)(g->p.x + dx * g->p.speed), (int)g->p.y, g->p.w, g->p.h};
  if (IsWalkable(g->room, nx)) g->p.x = (float)nx.x;
  RectI ny = {(int)g->p.x, (int)(g->p.y + dy * g->p.speed), g->p.w, g->p.h};
  if (IsWalkable(g->room, ny)) g->p.y = (float)ny.y;
  if (g->p.x != oldX || g->p.y != oldY) g->p.step += 8.0f * dt;

  Room *r = &gRooms[g->room];
  RectI pr = PlayerRect(g->p);
  for (int i = 0; i < r->exitCount; ++i) {
    if (Overlap(pr, r->exits[i].zone)) {
      g->room = r->exits[i].target;
      g->p.x = r->exits[i].spawn.x;
      g->p.y = r->exits[i].spawn.y;
      PushMsg(g, r->exits[i].note);
      SnapToWalkable(g);
      break;
    }
  }

  if (IsKeyPressed(KEY_E)) Interact(g);
  if (IsKeyPressed(KEY_SPACE)) PushMsg(g, "You inspect the area.");
}

static void DrawScene(Game *g, float t) {
  if (g->room == ROOM_YARD) DrawYardScene(t);
  else if (g->room == ROOM_COTTAGE) DrawCottageScene();
  else DrawForestScene();

  DrawPlayer(g);

  DrawRectangle(0, 0, VIRTUAL_W, 12, (Color){0, 0, 0, 120});
  DrawText(gRooms[g->room].name, 4, 2, 8, (Color){244, 233, 207, 255});
  DrawText("WASD Move  E Interact", 164, 2, 8, (Color){244, 233, 207, 255});

  int y = VIRTUAL_H - 10;
  for (int i = 0; i < g->msgCount && i < 3; ++i) {
    DrawRectangle(2, y - 1, VIRTUAL_W - 4, 9, (Color){0, 0, 0, 130});
    DrawText(g->msgs[i], 4, y, 8, (Color){244, 233, 207, 255});
    y -= 10;
  }
}

int main(void) {
  InitWindow(VIRTUAL_W * SCALE, VIRTUAL_H * SCALE, "KQ3 VGA C Prototype");
  SetTargetFPS(60);
  RenderTexture2D rt = LoadRenderTexture(VIRTUAL_W, VIRTUAL_H);
  SetTextureFilter(rt.texture, TEXTURE_FILTER_POINT);

  if (FileExists("../cottage.png")) {
    Image i = LoadImage("../cottage.png");
    gAssets.bgYard = LoadTextureFromImage(i);
    SetTextureFilter(gAssets.bgYard, TEXTURE_FILTER_BILINEAR);
    UnloadImage(i);
    gAssets.hasYard = true;
  }
  if (FileExists("../cottage_interior.png")) {
    Image i = LoadImage("../cottage_interior.png");
    gAssets.bgCottage = LoadTextureFromImage(i);
    SetTextureFilter(gAssets.bgCottage, TEXTURE_FILTER_BILINEAR);
    UnloadImage(i);
    gAssets.hasCottage = true;
  }
  if (FileExists("../forest_path.png")) {
    Image i = LoadImage("../forest_path.png");
    gAssets.bgForest = LoadTextureFromImage(i);
    SetTextureFilter(gAssets.bgForest, TEXTURE_FILTER_BILINEAR);
    UnloadImage(i);
    gAssets.hasForest = true;
  }
  if (FileExists("../main_char.png")) {
    Image mc = LoadImage("../main_char.png");
    // Force opaque alpha for stability; some generated sheets contain inconsistent
    // alpha in frame regions which can cause apparent flicker/invisibility.
    ImageFormat(&mc, PIXELFORMAT_UNCOMPRESSED_R8G8B8A8);
    Color *pix = (Color *)mc.data;
    if (pix) {
      int total = mc.width * mc.height;
      for (int i = 0; i < total; ++i) pix[i].a = 255;
    }
    gAssets.mainChar = LoadTextureFromImage(mc);
    SetTextureFilter(gAssets.mainChar, TEXTURE_FILTER_POINT);
    UnloadImage(mc);
    gAssets.hasMainChar = true;
  }
  if (FileExists("../sprites_1.png")) {
    Image si = LoadImage("../sprites_1.png");
    Color key = GetImageColor(si, 0, 0);
    ImageColorReplace(&si, key, BLANK);
    gAssets.sprites = LoadTextureFromImage(si);
    SetTextureFilter(gAssets.sprites, TEXTURE_FILTER_POINT);
    UnloadImage(si);
    gAssets.hasSprites = true;
  }

  BuildRooms();

  Game g = {0};
  g.room = ROOM_YARD;
  g.p = (Player){100, 130, 8, 14, 1.5f, 0, 0.0f};
  PushMsg(&g, "C version online. VGA style active.");
  PushMsg(&g, "Use WASD / arrows. E to interact.");
  SnapToWalkable(&g);

  while (!WindowShouldClose()) {
    float dt = GetFrameTime();
    UpdateGame(&g, dt);

    BeginTextureMode(rt);
    ClearBackground((Color){12, 12, 16, 255});
    DrawScene(&g, GetTime());
    EndTextureMode();

    BeginDrawing();
    ClearBackground(BLACK);
    Rectangle src = {0, 0, (float)VIRTUAL_W, (float)-VIRTUAL_H};
    Rectangle dst = {0, 0, (float)VIRTUAL_W * SCALE, (float)VIRTUAL_H * SCALE};
    DrawTexturePro(rt.texture, src, dst, (Vector2){0, 0}, 0.0f, WHITE);
    EndDrawing();
  }

  UnloadRenderTexture(rt);
  if (gAssets.hasYard) UnloadTexture(gAssets.bgYard);
  if (gAssets.hasCottage) UnloadTexture(gAssets.bgCottage);
  if (gAssets.hasForest) UnloadTexture(gAssets.bgForest);
  if (gAssets.hasMainChar) UnloadTexture(gAssets.mainChar);
  if (gAssets.hasSprites) UnloadTexture(gAssets.sprites);
  CloseWindow();
  return 0;
}
