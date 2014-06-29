#include "CLightpack.h"

Lightpack::RGBCOLOR CLightpack::meanColorFromRGB32(Lightpack::Rect& rect) {
    ASSERT(mStride >= mWidth);
    const unsigned int totalPixels = rect.area();

    unsigned int totalR = 0, totalG = 0, totalB = 0;
    for (int r = 0; r < rect.height; r++) {
        int y = rect.y + r;

        BYTE* pixel = mFrameBuffer + (rect.x + y * mStride) * 4;      // 4 bytes per pixel
        for (int c = 0; c < rect.width; c++) {
            totalB += pixel[0];
            totalG += pixel[1];
            totalR += pixel[2];
            pixel += 4;
        }
    }
    return RGB((int)floor(totalR / totalPixels), (int)floor(totalG / totalPixels), (int)floor(totalB / totalPixels));
}

Lightpack::RGBCOLOR CLightpack::meanColorFromNV12(Lightpack::Rect& rect) {
    ASSERT(mStride >= mWidth);
    const unsigned int pixel_total = mStride * mHeight;
    const unsigned int totalPixels = rect.area();
    BYTE* Y = mFrameBuffer;
    BYTE* U = mFrameBuffer + pixel_total;
    BYTE* V = mFrameBuffer + pixel_total + 1;
    const int dUV = 2;

    BYTE* U_pos = U;
    BYTE* V_pos = V;

    // YUV420 to RGB
    unsigned int totalR = 0, totalG = 0, totalB = 0;
    for (int r = 0; r < rect.height; r++) {
        int y = r + rect.y;

        Y = mFrameBuffer + y * mStride + rect.x;
        U = mFrameBuffer + pixel_total + (y / 2) * mStride + (rect.x & 0x1 ? rect.x - 1 : rect.x);
        V = U + 1;

        for (int c = 0; c < rect.width; c++) {
            Lightpack::RGBCOLOR color = YUVToRGB(*(Y++), *U, *V);
            totalR += GET_RED(color);
            totalG += GET_GREEN(color);
            totalB += GET_BLUE(color);

            if ((rect.x + c) & 0x1) {
                U += dUV;
                V += dUV;
            }
        }
    }
    return RGB((int)floor(totalR / totalPixels), (int)floor(totalG / totalPixels), (int)floor(totalB / totalPixels));
}