import json
from urllib.parse import urlparse

import requests
from lxml import html
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path('icon-classifier', 'mainScrape')


def get_top_n_alexa_domains(top_n, path='top-1000000.txt'):
    with open(path, 'r') as f:
        all_domains = f.read().split('\n')[:top_n]

    all_extension_agnostics = set()

    single_extension_domains = []
    for domain in all_domains:
        extension_agnostic = domain.split('.')[0]

        if extension_agnostic not in all_extension_agnostics:
            all_extension_agnostics.add(extension_agnostic)

            single_extension_domains.append(domain)

    return single_extension_domains


def get_second_degree_urls(url):
    r = requests.post(
        'https://asia-east2-icon-classifier.cloudfunctions.net/secondDegreeUrls', json={'url': url})

    return json.loads(r.content)


def scrape_domain(domain):
    all_urls = get_second_degree_urls(f'http://{domain}')

    for url in all_urls:
        publisher.publish(
            topic_path,
            data=url.encode('utf-8') 
        )


def main():
    for domain in get_top_n_alexa_domains(1000):
        print(domain)
        scrape_domain(domain)

    
    # publisher.publish(
    #     topic_path,
    #     data='https://www.bbc.com/news/world-europe-49919305'.encode('utf-8') 
    # )
    

if __name__ == '__main__':
    main()
