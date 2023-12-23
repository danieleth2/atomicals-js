# Social FI Templates for Atomicals 

## Purpose and use cases

Host a social profile, brand or website at a (sub)realm like +myusername/profile

## Recommended Delegation

A realm should not contain the profile object directly as data because that would pollute the history of the realm over time. 
Instead, use a delegation pattern to link to another Atomical NFT that contains the profile information.

The advantage is that if a realm changes hands, then the new owner can quickly update the realm to point to their own Atomical NFT
profile object immediately that they may have created earlier or migrated from other realms. **Note: We actually recommend always using the `"d"` delegation
pattern even for any kind of realm zone record or profile data. The clients and services can easily resolve the type of profile with the `v` version field
in the delegate to know how to handle the data in the delegate. This will ensure the Realm histories are unpolluted and kept as simple as possible.

Example:

In the realm data store just a delegation like this:

```
{
  "d": "<atomical_id>"
}
```
The convention to use "d" for delegation is intended to be as concise as possible and indicate to services and sites to follow through to the "d" atomicalid

Then in the <atomical_id> NFT have the base-profile.json information.

## base-profile.json

The `base-profile.json` is a starting recommendation for hosting a social profile as an Atomicals profile for users and brands.

## Recommended minimum fields

The minimum fields recommended are to use:

- v (Fixed version at "v1")
- name
- image (urn to on-chain image stored with `dat` data storage)
- desc
- And perhaps a BTC receive address for donations

## Additional notes

The structure of the profile is designed in such a way that a partial update of the profile and links can be done with just the updated section.
We opted for using a map instead of an array for the links for that reason since arrays must be completely replaced, whereas objects can have individual
fields replaced.