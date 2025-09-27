import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export type PrVideoAsset = ImagePicker.ImagePickerAsset;

function buildUploadPath(userId: string, asset: ImagePicker.ImagePickerAsset, contentType: string) {
  const uriSegments = asset.uri.split('/');
  const lastSegment = uriSegments[uriSegments.length - 1] ?? '';
  const providedName = asset.fileName || lastSegment || 'video.mp4';
  const nameParts = providedName.split('.');
  const extFromName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  const extFromType = contentType.includes('/') ? contentType.split('/')[1] : '';
  const extension = ((extFromName || extFromType || 'mp4').toLowerCase()).replace(/[^a-z0-9]/g, '') || 'mp4';
  const baseName = (extFromName ? nameParts.slice(0, -1).join('.') : providedName) || 'video';
  const safeBase = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const finalName = `${safeBase}.${extension}`;
  return `${userId}/${Date.now()}-${finalName}`;
}

export async function pickPrVideoFromGallery(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Media library permission is required to attach a video.');
    return null;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    selectionLimit: 1,
    quality: 0.8,
  });

  if (res.canceled || !res.assets?.length) {
    return null;
  }

  return res.assets[0];
}

export async function uploadPrVideo(asset: ImagePicker.ImagePickerAsset, userId: string): Promise<string> {
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error('Could not read video file for upload.');
  }

  const blob = await response.blob();
  const contentType = asset.mimeType || blob.type || 'video/mp4';
  const fileName = buildUploadPath(userId, asset, contentType);

  const { data, error } = await supabase.storage.from('pr-videos').upload(fileName, blob, {
    contentType,
    upsert: false,
  });

  if (error) throw error;

  const { data: pub } = supabase.storage.from('pr-videos').getPublicUrl(data.path);
  return pub.publicUrl;
}
