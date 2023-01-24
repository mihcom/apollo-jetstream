import ReleaseInfo from './ReleaseInfo.vue'
import { Octokit } from 'https://cdn.skypack.dev/@octokit/rest'
import { useToast } from 'vue-toastification'

export default async function checkUpdates(appVersion) {
  const octokit = new Octokit(),
    releases = (await octokit.rest.repos.listReleases({ owner: 'mihcom', repo: 'apollo-jetstream' })).data,
    lastRelease = releases[0],
    ignoreVersionKey = 'ignoreUpdates',
    ignoreVersion = localStorage.getItem(ignoreVersionKey)

  if (lastRelease && lastRelease.tag_name !== appVersion && ignoreVersion !== lastRelease.tag_name) {
    const toast = useToast()

    toast.info(
      {
        component: ReleaseInfo,
        props: {
          version: lastRelease
        },
        listeners: {
          ignore: () => window.localStorage.setItem(ignoreVersionKey, lastRelease.tag_name)
        }
      },
      { timeout: 0, icon: false }
    )
  }
}
