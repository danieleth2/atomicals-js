
export const sleeper = async (seconds) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, seconds * 1000);
    })
  }

export function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}
