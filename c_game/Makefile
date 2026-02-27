CC := clang
CFLAGS := -O2 -std=c11 -Wall -Wextra -pedantic
RAYLIB_PREFIX := $(shell brew --prefix raylib)
INCLUDES := -I$(RAYLIB_PREFIX)/include
LIBS := -L$(RAYLIB_PREFIX)/lib -lraylib -framework OpenGL -framework Cocoa -framework IOKit -framework CoreAudio -framework CoreVideo

TARGET := kq3_vga
SRC := main.c

all: $(TARGET)

$(TARGET): $(SRC)
	$(CC) $(CFLAGS) $(INCLUDES) $(SRC) -o $(TARGET) $(LIBS)

run: $(TARGET)
	./$(TARGET)

clean:
	rm -f $(TARGET)
