import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_DIMENSION = 1200;

export type PickedImage = { uri: string; width: number; height: number };

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  quality: 1,
  exif: false,
};

export async function pickFromCamera(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync(pickerOptions);
  return result.canceled ? null : result.assets[0];
}

export async function pickFromGallery(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  return result.canceled ? null : result.assets[0];
}

export type PreparedImage = { uri: string; base64: string };

/**
 * Downscales to max 1200px and compresses to JPEG for upload. The base64 copy
 * feeds the tag-item edge function so AI suggestions can run before the item
 * (and its storage upload) exists.
 */
export async function prepareForUpload(image: PickedImage): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > MAX_DIMENSION) {
    context.resize(
      image.width >= image.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return { uri: saved.uri, base64: saved.base64 ?? '' };
}
