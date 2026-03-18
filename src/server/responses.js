function normalizeText(value) {
  if (Array.isArray(value)) {
    return value.filter((line) => line !== undefined && line !== null && line !== '').join('\n');
  }

  return String(value ?? '');
}

export function textResponse(value, metadata) {
  const response = {
    content: [
      {
        type: 'text',
        text: normalizeText(value),
      },
    ],
  };

  if (metadata !== undefined) {
    response.metadata = metadata;
  }

  return response;
}

export function errorResponse(value, metadata) {
  return {
    ...textResponse(value, metadata),
    isError: true,
  };
}

export function imageResponse(data, mimeType = 'image/png') {
  return {
    content: [
      {
        type: 'image',
        data,
        mimeType,
      },
    ],
  };
}
