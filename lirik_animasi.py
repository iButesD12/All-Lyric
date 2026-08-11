import math
import random
import sys

import pygame
import pygame.gfxdraw


# ============================================================
# CONFIG
# ============================================================
class Config:
    WIDTH, HEIGHT = 1280, 720
    FPS = 60

    BLACK = (0, 0, 0)
    WHITE = (255, 255, 255)

    # --- falling sparkle rain ---
    NUM_FALLING = 55
    FALL_SIZE_MIN, FALL_SIZE_MAX = 10, 26
    FALL_SPEED_MIN, FALL_SPEED_MAX = 45, 120       # px / sec
    FALL_DRIFT_MIN, FALL_DRIFT_MAX = -14, 14        # px / sec horizontal
    FALL_ROT_SPEED_MIN, FALL_ROT_SPEED_MAX = -0.6, 0.6   # rad / sec
    FALL_ALPHA_MIN, FALL_ALPHA_MAX = 165, 255

    # --- attached / breathing sparkle field ---
    NUM_ATTACHED = 34
    ATTACHED_SIZE_MIN, ATTACHED_SIZE_MAX = 8, 22
    BREATHE_SCALE_MIN, BREATHE_SCALE_MAX = 0.92, 1.08
    BREATHE_SPEED_MIN, BREATHE_SPEED_MAX = 0.12, 0.35   # rad / sec
    ATTACHED_ALPHA_BASE_MIN, ATTACHED_ALPHA_BASE_MAX = 130, 200
    ATTACHED_ALPHA_VARIATION = 18   # subtle brightness flicker range

    # --- lyric timing (seconds) ---
    LYRIC_FADE_IN = 1.3
    LYRIC_HOLD = 2.6
    LYRIC_FADE_OUT = 1.1
    LYRIC_GAP = 0.7
    LYRIC_FONT_SIZE = 66
    LYRIC_SCALE_IN_FROM = 0.92
    LYRIC_SCALE_OUT_TO = 1.05

    LYRIC_LINES = [
        "in the hush between heartbeats",
        "the sky remembers your name",
        "every falling light is a wish",
        "unspoken, but never unfelt",
        "we are made of quiet stardust",
        "and this moment, forever",
    ]


# ============================================================
# SPARKLE SHAPE (the ✧ glyph, drawn as a vector polygon)
# ============================================================
class SparkleTemplate:
    """
    Builds one cached, anti-aliased ✧ (four-point sparkle) surface at a
    generous canonical radius. Every particle scales/rotates a copy of
    this single surface instead of re-drawing a polygon every frame.
    """

    CANONICAL_RADIUS = 40

    def __init__(self, color=Config.WHITE):
        self.color = color
        self.surface = self._build(self.CANONICAL_RADIUS, color)

    @staticmethod
    def _build(radius, color):
        pad = 6
        size = radius * 2 + pad * 2
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        cx = cy = size // 2
        inner = radius * 0.22

        points = []
        for i in range(8):
            angle = math.radians(i * 45 - 90)  # point 0 aims straight up
            r = radius if i % 2 == 0 else inner
            points.append((cx + math.cos(angle) * r, cy + math.sin(angle) * r))

        rgba = (color[0], color[1], color[2], 255)
        pygame.gfxdraw.filled_polygon(surf, points, rgba)
        pygame.gfxdraw.aapolygon(surf, points, rgba)

        # tiny bright core at the center for extra sparkle
        core_r = max(2, int(inner * 0.85))
        pygame.gfxdraw.filled_circle(surf, cx, cy, core_r, rgba)
        pygame.gfxdraw.aacircle(surf, cx, cy, core_r, rgba)

        return surf

    def get(self, target_size, rotation_deg=0.0):
        """Return a rotated + scaled copy sized so its point-to-point span ~= target_size*2."""
        scale = target_size / self.CANONICAL_RADIUS
        return pygame.transform.rotozoom(self.surface, rotation_deg, scale)


# ============================================================
# FALLING SPARKLE — the main "gentle white rain" animation
# ============================================================
class FallingSparkle:
    def __init__(self, template: SparkleTemplate, screen_w, screen_h, spawn_anywhere=False):
        self.template = template
        self.screen_w = screen_w
        self.screen_h = screen_h
        self._respawn(initial=spawn_anywhere)

    def _respawn(self, initial=False):
        self.size = random.uniform(Config.FALL_SIZE_MIN, Config.FALL_SIZE_MAX)
        self.x = random.uniform(0, self.screen_w)
        self.y = (random.uniform(0, self.screen_h) if initial
                  else random.uniform(-self.screen_h * 0.3, -self.size))
        # slightly bigger sparkles drift down a touch faster (soft depth cue)
        size_t = (self.size - Config.FALL_SIZE_MIN) / (Config.FALL_SIZE_MAX - Config.FALL_SIZE_MIN)
        self.speed = random.uniform(Config.FALL_SPEED_MIN, Config.FALL_SPEED_MAX) * (0.85 + size_t * 0.3)
        self.drift = random.uniform(Config.FALL_DRIFT_MIN, Config.FALL_DRIFT_MAX)
        self.wobble_amp = random.uniform(4, 14)
        self.wobble_freq = random.uniform(0.3, 0.9)
        self.wobble_phase = random.uniform(0, math.tau)
        self.rotation = random.uniform(0, 360)
        self.rotation_speed = random.uniform(Config.FALL_ROT_SPEED_MIN, Config.FALL_ROT_SPEED_MAX)
        self.alpha = random.randint(Config.FALL_ALPHA_MIN, Config.FALL_ALPHA_MAX)
        self._base_x = self.x

    def update(self, dt, elapsed):
        self.y += self.speed * dt
        self._base_x += self.drift * dt
        self.x = self._base_x + math.sin(elapsed * self.wobble_freq + self.wobble_phase) * self.wobble_amp
        self.rotation += math.degrees(self.rotation_speed) * dt

        if self.y - self.size > self.screen_h or self.x < -60 or self.x > self.screen_w + 60:
            self._respawn(initial=False)

    def draw(self, surface):
        img = self.template.get(self.size, self.rotation)
        img.set_alpha(self.alpha)
        rect = img.get_rect(center=(self.x, self.y))
        surface.blit(img, rect)


# ============================================================
# ATTACHED SPARKLE — calm, breathing background field
# ============================================================
class AttachedSparkle:
    def __init__(self, template: SparkleTemplate, x, y):
        self.template = template
        self.x = x
        self.y = y
        self.base_size = random.uniform(Config.ATTACHED_SIZE_MIN, Config.ATTACHED_SIZE_MAX)
        self.phase = random.uniform(0, math.tau)
        self.speed = random.uniform(Config.BREATHE_SPEED_MIN, Config.BREATHE_SPEED_MAX)
        self.alpha_base = random.randint(Config.ATTACHED_ALPHA_BASE_MIN, Config.ATTACHED_ALPHA_BASE_MAX)
        self.flicker_phase = random.uniform(0, math.tau)
        self.flicker_speed = random.uniform(0.15, 0.4)

    def update(self, dt):
        self.phase += self.speed * dt
        self.flicker_phase += self.flicker_speed * dt

    def draw(self, surface):
        breathe_t = (math.sin(self.phase) + 1) * 0.5  # 0..1
        scale = Config.BREATHE_SCALE_MIN + breathe_t * (Config.BREATHE_SCALE_MAX - Config.BREATHE_SCALE_MIN)
        size = self.base_size * scale

        flicker = math.sin(self.flicker_phase) * Config.ATTACHED_ALPHA_VARIATION
        alpha = int(max(0, min(255, self.alpha_base + flicker)))

        img = self.template.get(size, 0.0)
        img.set_alpha(alpha)
        rect = img.get_rect(center=(self.x, self.y))
        surface.blit(img, rect)


# ============================================================
# SPARKLE FIELD — owns both particle collections
# ============================================================
class SparkleField:
    def __init__(self, template: SparkleTemplate, screen_w, screen_h):
        self.template = template
        self.screen_w = screen_w
        self.screen_h = screen_h

        self.falling = [
            FallingSparkle(template, screen_w, screen_h, spawn_anywhere=True)
            for _ in range(Config.NUM_FALLING)
        ]
        self.attached = [
            AttachedSparkle(template, *self._attached_position())
            for _ in range(Config.NUM_ATTACHED)
        ]

    def _attached_position(self):
        """Random position, gently avoiding the dead-center lyric zone
        so the breathing field frames the text instead of sitting on it."""
        exclude_w = self.screen_w * 0.30
        exclude_h = self.screen_h * 0.16
        cx, cy = self.screen_w / 2, self.screen_h / 2

        for _ in range(20):
            x = random.uniform(0, self.screen_w)
            y = random.uniform(0, self.screen_h)
            if abs(x - cx) > exclude_w or abs(y - cy) > exclude_h:
                return x, y
        return x, y  # fall back to last attempt if unlucky

    def update(self, dt, elapsed):
        for s in self.falling:
            s.update(dt, elapsed)
        for s in self.attached:
            s.update(dt)

    def draw(self, surface):
        # attached field first (depth backdrop), falling rain on top (main animation)
        for s in self.attached:
            s.draw(surface)
        for s in self.falling:
            s.draw(surface)


# ============================================================
# LYRIC SEQUENCE — centered fade in / hold / fade out / scale
# ============================================================
class LyricSequence:
    FADE_IN, HOLD, FADE_OUT, GAP = range(4)

    def __init__(self, lines, screen_w, screen_h):
        self.lines = lines
        self.screen_w = screen_w
        self.screen_h = screen_h

        self.font = pygame.font.Font(None, Config.LYRIC_FONT_SIZE)
        self.rendered = [self.font.render(line, True, Config.WHITE) for line in lines]

        self.index = 0
        self.phase = self.FADE_IN
        self.timer = 0.0

    @staticmethod
    def _ease_out_cubic(t):
        return 1 - (1 - t) ** 3

    @staticmethod
    def _ease_in_cubic(t):
        return t ** 3

    def update(self, dt):
        self.timer += dt

        if self.phase == self.FADE_IN and self.timer >= Config.LYRIC_FADE_IN:
            self.timer = 0.0
            self.phase = self.HOLD
        elif self.phase == self.HOLD and self.timer >= Config.LYRIC_HOLD:
            self.timer = 0.0
            self.phase = self.FADE_OUT
        elif self.phase == self.FADE_OUT and self.timer >= Config.LYRIC_FADE_OUT:
            self.timer = 0.0
            self.phase = self.GAP
        elif self.phase == self.GAP and self.timer >= Config.LYRIC_GAP:
            self.timer = 0.0
            self.phase = self.FADE_IN
            self.index = (self.index + 1) % len(self.lines)

    def _current_alpha_scale(self):
        if self.phase == self.FADE_IN:
            t = self._ease_out_cubic(min(1.0, self.timer / Config.LYRIC_FADE_IN))
            alpha = int(255 * t)
            scale = Config.LYRIC_SCALE_IN_FROM + (1.0 - Config.LYRIC_SCALE_IN_FROM) * t
        elif self.phase == self.HOLD:
            alpha = 255
            scale = 1.0
        elif self.phase == self.FADE_OUT:
            t = self._ease_in_cubic(min(1.0, self.timer / Config.LYRIC_FADE_OUT))
            alpha = int(255 * (1 - t))
            scale = 1.0 + (Config.LYRIC_SCALE_OUT_TO - 1.0) * t
        else:  # GAP
            alpha = 0
            scale = 1.0
        return alpha, scale

    def draw(self, surface):
        alpha, scale = self._current_alpha_scale()
        if alpha <= 0:
            return

        base = self.rendered[self.index]
        if abs(scale - 1.0) > 0.001:
            img = pygame.transform.smoothscale(
                base,
                (max(1, int(base.get_width() * scale)), max(1, int(base.get_height() * scale)))
            )
        else:
            img = base.copy()

        img.set_alpha(alpha)
        rect = img.get_rect(center=(self.screen_w // 2, self.screen_h // 2))
        surface.blit(img, rect)


# ============================================================
# APP
# ============================================================
class App:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption("Sparkle Lyrics — Cinematic ✧ Animation")
        self.screen = pygame.display.set_mode((Config.WIDTH, Config.HEIGHT))
        self.clock = pygame.time.Clock()

        self.template = SparkleTemplate(Config.WHITE)
        self.field = SparkleField(self.template, Config.WIDTH, Config.HEIGHT)
        self.lyrics = LyricSequence(Config.LYRIC_LINES, Config.WIDTH, Config.HEIGHT)

        self.elapsed = 0.0
        self.running = True

    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                self.running = False

    def update(self, dt):
        self.elapsed += dt
        self.field.update(dt, self.elapsed)
        self.lyrics.update(dt)

    def draw(self):
        self.screen.fill(Config.BLACK)
        self.field.draw(self.screen)
        self.lyrics.draw(self.screen)
        pygame.display.flip()

    def run(self):
        while self.running:
            dt = self.clock.tick(Config.FPS) / 1000.0
            dt = min(dt, 1 / 30)  # avoid huge jumps if the window is dragged/minimized
            self.handle_events()
            self.update(dt)
            self.draw()

        pygame.quit()
        sys.exit()


if __name__ == "__main__":
    App().run()