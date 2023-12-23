// A trait
export const validateTrait = (trait) => {
  if (!trait) {
    return false;
  }
}
export const validateContainerTraits = (traits) => {
  if (!Array.isArray(traits)) {
    return false;
  }
  for (const trait of traits) {
    if (!validateTrait(trait)) {
      return false;
    }  
  }
  return false;
}

export const validateContainerItems = (items) => {

  return false;
}

export const validateContainerItemsForDmint = (dmint) => {

  return false;
}

export const validateContainerMetadata = (meta) => {

  return false;
}

export const validateContainerAll = (data) => {
  if (!data['traits']) {
    return false;
  }
  if (!data['meta']) {
    return false;
  }
  if (!data['items']) {
    return false;
  }
  if (!data['dmint']) {
    return false;
  }
  return validateContainerTraits(data['traits']) && 
    validateContainerTraits(data['meta']) &&
    validateContainerTraits(data['items']) &&
    validateContainerTraits(data['dmint']);
}
