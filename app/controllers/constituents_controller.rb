class ConstituentsController < ApplicationController

  respond_to :html, :json

  def index
  end

  def map
  end

  def show
    connection_string = "https://#{ENV['ELASTIC_USER']}:#{ENV['ELASTIC_PASSWORD']}@#{ENV['ELASTIC_HOST']}"
    client = Elasticsearch::Client.new host: connection_string
    begin
      results = client.search index: 'pic', q: "constituent.ConstituentID:#{params[:id]}"
    rescue
      @constituent = nil
    end
    if results && results["hits"]["total"] > 0
      @constituent = results["hits"]["hits"][0]["_source"]
    end
    respond_with @constituent do |f|
      f.html
      f.json
    end
  end

end
